import { motion } from "framer-motion";

export function BackgroundOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden dark:block">
      <motion.div
        aria-hidden
        className="absolute -top-40 -left-32 size-[520px] rounded-full opacity-60 blur-[120px]"
        style={{
          background: "radial-gradient(circle, oklch(0.7 0.22 285 / 0.65), transparent 60%)",
        }}
        animate={{ x: [0, 40, 0], y: [0, -20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -top-20 right-[-10%] size-[480px] rounded-full opacity-50 blur-[120px]"
        style={{
          background: "radial-gradient(circle, oklch(0.78 0.16 200 / 0.55), transparent 60%)",
        }}
        animate={{ x: [0, -30, 0], y: [0, 30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute bottom-[-20%] left-1/3 size-[600px] rounded-full opacity-40 blur-[140px]"
        style={{
          background: "radial-gradient(circle, oklch(0.65 0.22 320 / 0.5), transparent 60%)",
        }}
        animate={{ x: [0, 30, 0], y: [0, -40, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* subtle noise */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </div>
  );
}
