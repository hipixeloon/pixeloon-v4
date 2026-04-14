import { useState } from 'react';
import { Clock, Shuffle, Plus, X } from 'lucide-react';
import { IOSInput } from '@/components/ui/IOSInput';
import { IOSSwitch } from '@/components/ui/IOSSwitch';
import { IOSButton } from '@/components/ui/IOSButton';

export interface PostTime {
  id: string;
  time: string;
  randomize: boolean;
  randomRange: number; // minutes +/- from selected time
}

interface ScheduleConfigProps {
  postTimes: PostTime[];
  onChange: (times: PostTime[]) => void;
}

export function ScheduleConfig({ postTimes, onChange }: ScheduleConfigProps) {
  const addPostTime = () => {
    const newTime: PostTime = {
      id: Date.now().toString(),
      time: '12:00',
      randomize: true,
      randomRange: 30,
    };
    onChange([...postTimes, newTime]);
  };

  const removePostTime = (id: string) => {
    if (postTimes.length > 1) {
      onChange(postTimes.filter((t) => t.id !== id));
    }
  };

  const updatePostTime = (id: string, updates: Partial<PostTime>) => {
    onChange(postTimes.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const randomizeAllTimes = () => {
    const baseHours = [9, 11, 14, 17, 20]; // Common posting hours
    const newTimes = postTimes.map((t, i) => ({
      ...t,
      time: `${baseHours[i % baseHours.length].toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
      randomize: true,
    }));
    onChange(newTimes);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-ios-subhead text-muted-foreground">Daily Post Times</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={randomizeAllTimes}
            className="text-ios-caption text-primary flex items-center gap-1"
          >
            <Shuffle className="w-3 h-3" />
            Randomize All
          </button>
        </div>
      </div>

      <div className="ios-card divide-y divide-border">
        {postTimes.map((postTime, index) => (
          <div key={postTime.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-ios-subhead text-foreground">
                Post #{index + 1}
              </span>
              {postTimes.length > 1 && (
                <button
                  onClick={() => removePostTime(postTime.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-destructive/10 text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <input
                  type="time"
                  value={postTime.time}
                  onChange={(e) => updatePostTime(postTime.id, { time: e.target.value })}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-ios-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-muted-foreground" />
                <span className="text-ios-caption text-muted-foreground">
                  Randomize ±{postTime.randomRange}min
                </span>
              </div>
              <button
                onClick={() => updatePostTime(postTime.id, { randomize: !postTime.randomize })}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  postTime.randomize ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 bg-card rounded-full shadow transition-transform ${
                    postTime.randomize ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {postTime.randomize && (
              <div className="flex items-center gap-2">
                <span className="text-ios-caption text-muted-foreground">Range:</span>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={postTime.randomRange}
                  onChange={(e) => updatePostTime(postTime.id, { randomRange: parseInt(e.target.value) })}
                  className="flex-1 accent-primary"
                />
                <span className="text-ios-caption text-foreground w-12 text-right">
                  ±{postTime.randomRange}m
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {postTimes.length < 10 && (
        <IOSButton variant="secondary" fullWidth onClick={addPostTime}>
          <Plus className="w-4 h-4 mr-2" />
          Add Post Time ({postTimes.length}/10)
        </IOSButton>
      )}

      <p className="text-ios-caption text-muted-foreground px-1">
        💡 Randomizing times makes your posts look more natural and less automated.
      </p>
    </div>
  );
}
