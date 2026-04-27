
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../middleware/logging';

const router = express.Router();

// Strict DOI regex
const DOI_REGEX = /^10\.\d{4,9}\/[^\s]+$/;

// ── Layer 1: Unpaywall (Legal Open Access) ──
const UNPAYWALL_EMAIL = 'admin@doiscan.ai';

// ── Layer 2: Sci-Hub PDF CDN (extracted from Sci-Hub mirror HTML analysis) ──
// Sci-Hub mirrors embed PDFs via src="https://sci.bban.top/pdf/{DOI}.pdf"
const SCIHUB_PDF_CDNS = [
  'https://sci.bban.top/pdf',
  'https://zero.sci-hub.se',
];

// ── Layer 3: Sci-Hub mirrors for HTML parsing fallback ──
const SCIHUB_MIRRORS = [
  'https://sci-hub.ee',
  'https://sci-hub.al',
  'https://sci-hub.mk',
  'https://sci-hub.vg',
  'https://sci-hub.ru',
  'https://sci-hub.st',
];

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Layer 1: Unpaywall (legal open-access).
 * Returns the direct PDF URL or null.
 */
async function tryUnpaywall(doi: string): Promise<string | null> {
  try {
    const res = await axios.get(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${UNPAYWALL_EMAIL}`,
      { timeout: 8000 }
    );
    
    const pdfUrl = res.data?.best_oa_location?.url_for_pdf;
    if (pdfUrl) {
      logger.info({ doi, source: 'unpaywall' }, 'Open Access PDF found via Unpaywall');
      return pdfUrl;
    }
    
    // Some entries have url but not url_for_pdf
    const landingUrl = res.data?.best_oa_location?.url;
    if (landingUrl && landingUrl.endsWith('.pdf')) {
      return landingUrl;
    }
    
    return null;
  } catch (err: any) {
    logger.debug({ doi, error: err.message }, 'Unpaywall lookup failed');
    return null;
  }
}

/**
 * Layer 2: Direct Sci-Hub PDF CDN.
 * Sci-Hub stores PDFs at predictable URLs like:
 *   https://sci.bban.top/pdf/10.1016/j.watres.2006.12.019.pdf
 * This bypasses the HTML landing page entirely.
 */
async function trySciHubCDN(doi: string): Promise<string | null> {
  for (const cdn of SCIHUB_PDF_CDNS) {
    const pdfUrl = `${cdn}/${doi}.pdf`;
    try {
      // HEAD request to check if PDF exists without downloading
      const headRes = await axios.head(pdfUrl, {
        timeout: 6000,
        maxRedirects: 3,
        headers: { 'User-Agent': BROWSER_UA },
        validateStatus: (status) => status < 400,
      });
      
      const ct = headRes.headers['content-type'] || '';
      if (ct.includes('pdf') || ct.includes('octet-stream')) {
        logger.info({ doi, cdn, size: headRes.headers['content-length'] }, 'Sci-Hub CDN PDF found');
        return pdfUrl;
      }
    } catch (err: any) {
      logger.debug({ doi, cdn, error: err.message }, 'CDN check failed');
    }
  }
  return null;
}

/**
 * Layer 3: Sci-Hub HTML page parsing.
 * Fetch the Sci-Hub mirror HTML page and extract the embedded PDF src.
 * Pattern found in live analysis: src="https://sci.bban.top/pdf/{DOI}.pdf#view=FitH"
 */
async function trySciHubHTML(doi: string): Promise<string | null> {
  for (const mirror of SCIHUB_MIRRORS) {
    try {
      const scihubUrl = `${mirror}/${doi}`;
      const response = await axios.get(scihubUrl, {
        timeout: 8000,
        maxRedirects: 5,
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        responseType: 'text'
      });

      const html = response.data as string;
      
      // Check if response is directly a PDF
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/pdf')) {
        return scihubUrl;
      }

      // Extract PDF URL from HTML using patterns found in live Sci-Hub pages
      const pdfPatterns = [
        // Primary: src="https://sci.bban.top/pdf/10.xxxx/yyyy.pdf#view=FitH"
        /src=["'](https?:\/\/[^"']*\.pdf[^"']*)/i,
        // Embedded iframe/embed with any URL
        /(?:iframe|embed)[^>]+src=["']([^"']+\.pdf[^"']*)/i,
        // Protocol-relative  
        /src=["'](\/\/[^"']*\.pdf[^"']*)/i,
        // Button onclick
        /location\.href\s*=\s*["']([^"']+\.pdf[^"']*)/i,
        // id="pdf" element
        /id=["']pdf["'][^>]*src=["']([^"']+)/i,
      ];

      for (const pattern of pdfPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          let pdfUrl = match[1];
          
          // Clean up fragment identifiers for streaming
          pdfUrl = pdfUrl.split('#')[0];
          
          // Handle protocol-relative URLs
          if (pdfUrl.startsWith('//')) {
            pdfUrl = 'https:' + pdfUrl;
          } else if (pdfUrl.startsWith('/')) {
            pdfUrl = mirror + pdfUrl;
          }
          
          logger.info({ doi, mirror, pdfUrl: pdfUrl.substring(0, 100) }, 'Sci-Hub PDF URL extracted from HTML');
          return pdfUrl;
        }
      }

      // Check for "article not found" indicators
      if (html.includes('article not found') || html.includes('no matching proxies') || html.includes('mutual aid community')) {
        logger.debug({ doi, mirror }, 'Paper not in Sci-Hub database');
        break; // No point trying other mirrors for the same paper
      }
      
      logger.debug({ doi, mirror }, 'Mirror responded but no PDF link found');
    } catch (error: any) {
      logger.debug({ doi, mirror, error: error.message }, 'Mirror failed');
    }
  }
  
  return null;
}

/**
 * Stream a PDF from a URL to the Express response.
 */
async function streamPdf(pdfUrl: string, doi: string, res: express.Response): Promise<boolean> {
  try {
    const pdfResponse = await axios({
      method: 'get',
      url: pdfUrl,
      timeout: 20000,
      responseType: 'stream',
      maxRedirects: 5,
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/pdf,*/*',
        'Referer': 'https://sci-hub.ee/',
      },
    });

    const contentType = pdfResponse.headers['content-type'] || '';
    
    // Accept PDF or octet-stream
    if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
      res.setHeader('Content-Type', 'application/pdf');
      if (pdfResponse.headers['content-length']) {
        res.setHeader('Content-Length', pdfResponse.headers['content-length']);
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `attachment; filename="${doi.replace(/\//g, '_')}.pdf"`);
      
      pdfResponse.data.pipe(res);
      return true;
    }
    
    logger.debug({ pdfUrl, contentType }, 'URL did not return PDF content-type');
    return false;
  } catch (err: any) {
    logger.debug({ pdfUrl, error: err.message }, 'PDF stream failed');
    return false;
  }
}

// ── Main Download Endpoint ──
// Express 5: {*doi} captures the full DOI path including slashes
router.get('/download/{*doi}', async (req, res) => {
  const rawDoi = req.params.doi;
  const doi = Array.isArray(rawDoi) ? rawDoi.join('/') : rawDoi;
  const ipHash = crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex');

  logger.info({ doi, ip_hash: ipHash }, 'Download request received');

  // Strict DOI Validation
  if (!DOI_REGEX.test(doi)) {
    logger.warn({ doi, ip_hash: ipHash }, 'Invalid DOI format rejected');
    return res.status(400).json({ error: 'Malformed DOI input' });
  }

  // ── Layer 1: Unpaywall (Legal Open Access) ──
  const oaPdfUrl = await tryUnpaywall(doi);
  if (oaPdfUrl) {
    const streamed = await streamPdf(oaPdfUrl, doi, res);
    if (streamed) return;
    logger.debug({ doi }, 'Unpaywall URL found but streaming failed');
  }

  // ── Layer 2: Direct Sci-Hub PDF CDN ──
  const cdnUrl = await trySciHubCDN(doi);
  if (cdnUrl) {
    const streamed = await streamPdf(cdnUrl, doi, res);
    if (streamed) return;
    logger.debug({ doi }, 'CDN URL found but streaming failed');
  }

  // ── Layer 3: Sci-Hub HTML Page Parsing ──
  const parsedUrl = await trySciHubHTML(doi);
  if (parsedUrl) {
    const streamed = await streamPdf(parsedUrl, doi, res);
    if (streamed) return;
    logger.debug({ doi }, 'HTML-parsed URL found but streaming failed');
  }

  // ── All strategies exhausted ──
  logger.warn({ doi }, 'All download sources exhausted');
  res.status(502).json({ 
    error: 'PDF not available through automated download.',
    fallbackUrl: `https://doi.org/${doi}`,
    scholarUrl: `https://scholar.google.com/scholar?q=${encodeURIComponent(doi)}`,
    details: 'This paper may not be in the open-access or Sci-Hub databases. Try the DOI.org or Google Scholar links.'
  });
});

/**
 * Availability check endpoint
 */
router.get('/check/{*doi}', async (req, res) => {
  const rawDoi = req.params.doi;
  const doi = Array.isArray(rawDoi) ? rawDoi.join('/') : rawDoi;
  
  if (!DOI_REGEX.test(doi)) {
    return res.status(400).json({ error: 'Malformed DOI input' });
  }

  const sources: Array<{ name: string; available: boolean; url?: string }> = [];

  // Check Unpaywall
  const oaUrl = await tryUnpaywall(doi);
  sources.push({ name: 'Unpaywall (Open Access)', available: !!oaUrl, url: oaUrl || undefined });

  // Check Sci-Hub CDN
  const cdnUrl = await trySciHubCDN(doi);
  sources.push({ name: 'Sci-Hub CDN', available: !!cdnUrl, url: cdnUrl || undefined });

  sources.push({ name: 'DOI.org (Publisher)', available: true, url: `https://doi.org/${doi}` });

  res.json({ doi, sources });
});

export default router;
