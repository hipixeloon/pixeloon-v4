import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface IOSTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const IOSTextarea = forwardRef<HTMLTextAreaElement, IOSTextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-ios-subhead text-muted-foreground px-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'ios-input text-ios-body min-h-[100px] resize-none',
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

IOSTextarea.displayName = 'IOSTextarea';
