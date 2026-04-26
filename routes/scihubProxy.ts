
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../middleware/logging';

const router = express.Router();

// Strict DOI regex
const DOI_REGEX = /^10\.\d{4,9}\/[^\s]+$/;

// Sci-Hub mirrors to try sequentially
const SCIHUB_MIRRORS = [
  'https://sci-hub.ru',
  'https://sci-hub.st',
  'https://sci-hub.se',
  'https://sci-hub.red',
  'https://sci-hub.box'
];

router.get('/download/:doi', async (req, res) => {
  const { doi } = req.params;
  const ipHash = crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex');

  logger.info({ doi, ip_hash: ipHash, timestamp: new Date().toISOString() }, 'DOI download attempt with dynamic mirrors');

  // 1. Strict DOI Validation
  if (!DOI_REGEX.test(doi)) {
    logger.warn({ doi, ip_hash: ipHash }, 'Invalid DOI format rejected');
    return res.status(400).json({ error: 'Malformed DOI input' });
  }

  let success = false;
  let lastError = null;

  // Try each mirror until success
  for (const mirror of SCIHUB_MIRRORS) {
    try {
      const scihubUrl = `${mirror}/${doi}`;
      logger.info({ doi, mirror }, 'Testing mirror');
      
      const response = await axios({
        method: 'get',
        url: scihubUrl,
        timeout: 8000, // Slightly shorter timeout per mirror for faster failover
        responseType: 'stream',
        headers: {
          'User-Agent': 'Academic-Extractor-Bot/1.0',
        },
      });

      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/pdf')) {
        // Success!
        logger.info({ doi, mirror }, 'Mirror success');
        
        res.setHeader('Content-Type', 'application/pdf');
        if (response.headers['content-length']) {
          res.setHeader('Content-Length', response.headers['content-length']);
        }
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', `attachment; filename="${doi.replace(/\//g, '_')}.pdf"`);

        response.data.pipe(res);
        success = true;
        break; // Exit the loop
      } else {
        logger.warn({ doi, mirror, contentType }, 'Mirror returned non-PDF content, trying next...');
      }
    } catch (error: any) {
      lastError = error.message;
      logger.warn({ doi, mirror, error: lastError }, 'Mirror failed, trying next...');
    }
  }

  if (!success) {
    logger.error({ doi, last_error: lastError }, 'All Sci-Hub mirrors failed');
    res.status(502).json({ 
      error: 'All research mirrors are currently unavailable for this document.',
      details: 'This may happen for papers published after 2021 or if the mirrors are temporarily blocked.'
    });
  }
});

export default router;
