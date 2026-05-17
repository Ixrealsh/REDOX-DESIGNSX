import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  children,
  className,
  variant = 'primary',
  fullWidth = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], fullWidth ? styles.fullWidth : '', className || '']
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}
