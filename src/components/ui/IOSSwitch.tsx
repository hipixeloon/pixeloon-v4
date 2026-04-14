import { Switch } from '@/components/ui/switch';

interface IOSSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export function IOSSwitch({ checked, onCheckedChange, label, description }: IOSSwitchProps) {
  return (
    <div className="ios-list-item">
      <div className="flex-1">
        <p className="text-ios-body text-foreground">{label}</p>
        {description && (
          <p className="text-ios-footnote text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
