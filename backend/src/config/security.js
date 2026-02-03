import helmet from "helmet";

export function security() {
  return helmet({
    crossOriginEmbedderPolicy: false, // evita quebrar alguns recursos comuns
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'none'"],
        "img-src": ["'self'", "data:"],
        "script-src": ["'self'"],
        "style-src": ["'self'"],
        "font-src": ["'self'"],
        "connect-src": ["'self'"]
      }
    },
    referrerPolicy: { policy: "no-referrer" },
    frameguard: { action: "deny" },
    noSniff: true,
    xssFilter: false // legado
  });
}
