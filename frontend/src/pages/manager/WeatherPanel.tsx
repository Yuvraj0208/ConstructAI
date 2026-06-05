import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/ui';
import type { Weather } from '../../types';

export function weatherEmoji(condition: string, rain: boolean): string {
  const c = condition.toLowerCase();
  if (c.includes('thunder')) return '⛈️';
  if (rain || c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌧️';
  if (c.includes('snow')) return '🌨️';
  if (c.includes('fog')) return '🌫️';
  if (c.includes('cloud') || c.includes('overcast')) return '☁️';
  if (c.includes('clear')) return '☀️';
  return '🌤️';
}

export function WeatherPanel({ city }: { city?: string | null }) {
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    api
      .get<Weather>('/weather', { params: city ? { city } : {} })
      .then((r) => setWeather(r.data))
      .catch(() => {});
  }, [city]);

  if (!weather) return null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-5xl">{weatherEmoji(weather.condition, weather.will_rain)}</div>
          <div>
            <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Weather · {weather.city}
            </div>
            <div className="text-xl font-bold text-slate-900">
              {weather.condition}
              {weather.temp_c != null ? `, ${Math.round(weather.temp_c)}°C` : ''}
            </div>
            <div className="text-xs text-slate-400">
              {weather.source === 'live' ? 'Live forecast' : 'Simulated (offline)'}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {weather.days.map((d) => (
            <div
              key={d.date}
              className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-center"
            >
              <div className="text-xs text-slate-500">{d.date.slice(5)}</div>
              <div className="text-lg">{weatherEmoji(d.condition, d.rain)}</div>
              <div className="text-xs text-slate-600">
                {d.temp_max_c != null ? `${Math.round(d.temp_max_c)}°` : ''}
              </div>
              <div className="text-[10px] text-sky-600">
                {d.precipitation_mm > 0 ? `${d.precipitation_mm}mm` : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {weather.will_rain && weather.advisory.length > 0 && (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          🌧️ Rain expected — the engine adds a buffer when reordering weather-sensitive materials:{' '}
          <strong>{weather.advisory.join(', ')}</strong>.
        </div>
      )}
    </Card>
  );
}
