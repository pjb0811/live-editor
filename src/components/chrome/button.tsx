import { cn } from '~/utils/cn';

import styles from './button.module.css';

interface ButtonProps extends Omit<
  React.ComponentPropsWithRef<'button'>,
  'type'
> {
  variant?: 'outlined' | 'solid' | 'text';
  tone?: 'neutral' | 'primary' | 'danger' | 'success';
  size?: 'small' | 'middle';
  shape?: 'default' | 'circle';
  // Drawn before `children`. A button with an icon and no children is
  // square, and needs an `aria-label`.
  icon?: React.ReactNode;
}

// The chrome's button. Always `type="button"`, so it never submits a form
// the editor sits in.
const Button = ({
  variant = 'outlined',
  tone = 'neutral',
  size = 'middle',
  shape = 'default',
  icon,
  className,
  children,
  ...restProps
}: ButtonProps) => (
  <button
    type="button"
    className={cn(
      styles.button,
      styles[variant],
      tone !== 'neutral' && styles[tone],
      size === 'small' && styles.small,
      shape === 'circle' && styles.circle,
      icon && !children && styles.iconOnly,
      className,
    )}
    {...restProps}
  >
    {icon}
    {children}
  </button>
);

export default Button;
