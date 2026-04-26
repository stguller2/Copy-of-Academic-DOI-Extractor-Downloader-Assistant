
import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "https://cdn.tailwindcss.com"], // Tailwind CDN and inline scripts needed for some components
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://picsum.photos"],
      connectSrc: ["'self'"],
      frameAncestors: ["*"], // Crucial for AI Studio iframe
      upgradeInsecureRequests: [],
    },
  },
  xPoweredBy: false,
  referrerPolicy: { policy: 'no-referrer' },
});
