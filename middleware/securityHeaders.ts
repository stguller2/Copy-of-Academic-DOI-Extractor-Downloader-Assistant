
import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://picsum.photos"],
      workerSrc: ["'self'", "blob:", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "blob:", "ws:", "wss:", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      frameAncestors: ["*"],
      upgradeInsecureRequests: [],
    },
  },
  xPoweredBy: false,
  referrerPolicy: { policy: 'no-referrer' },
});
