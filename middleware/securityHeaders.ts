
import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://picsum.photos"],
      connectSrc: ["'self'", "blob:"],
      frameAncestors: ["*"],
      upgradeInsecureRequests: [],
    },
  },
  xPoweredBy: false,
  referrerPolicy: { policy: 'no-referrer' },
});
