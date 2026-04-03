import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface IOSInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const IOSInput = forwardRef<HTMLInputElement, IOSInputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-ios-subhead text-muted-foreground px-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'ios-input text-ios-body',
            error && 'ring-2 ring-destructive/50',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-ios-caption text-destructive px-1">{error}</p>
        )}
      </div>
    );
  }
);

IOSInput.displayName = 'IOSInput';
