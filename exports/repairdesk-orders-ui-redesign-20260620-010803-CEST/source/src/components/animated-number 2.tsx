import { useEffect } from "react";
import { animate, useMotionValue, useTransform } from "framer-motion";
import { motion } from "framer-motion";

export function AnimatedNumber({
  value,
  duration = 1.1,
  format = (n) => Math.round(n).toLocaleString("zh-CN"),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const out = useTransform(mv, (v) => format(v));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [value, duration, mv]);

  return <motion.span className={className}>{out}</motion.span>;
}
