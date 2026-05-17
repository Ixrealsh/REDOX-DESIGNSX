import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './Button.module.css';

interface LinkButtonProps {
  children: ReactNode;
  href: string;
  variant?: 'primary' | 'secondary' | 'dark' | 'ghost';
  fullWidth?: boolean;
  className?: string;
}

export function LinkButton({
  children,
  href,
  variant = 'primary',
  fullWidth = false,
  className
}: LinkButtonProps) {
  const classes = [styles.button, styles[variant], fullWidth ? styles.fullWidth : '', className || '']
    .filter(Boolean)
    .join(' ');

  return (
    <Link className={classes} href={href}>
      {children}
    </Link>
  );
}
