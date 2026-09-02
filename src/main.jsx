import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const DEFAULT_LOCATION = {
  name: 'Bay City, MI',
  latitude: 43.5945,
  longitude: -83.8889,
  timezone: 'America/Detroit'
};

const STORAGE_KEY = 'weather-schedule-location';
const SCHEDULE_KEY = 'weather-schedule-events';

const weatherLabels = {
  0: ['Clear', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'], 51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
  56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'], 61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'], 71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'],
  77: ['Snow grains', '🌨️'], 80: ['Rain showers', '🌦️'], 81: ['Rain showers', '🌧️'], 82: ['Heavy showers', '🌧️'],
  85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '❄️'], 95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm + hail', '⛈️'], 99: ['Thunderstorm + hail', '⛈️']
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function localDateString(date = new Date(), timezone = DEFAULT_LOCATION.timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(dateString, days) {
  const d = new Date(`${dateString}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatLongDate(dateString) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(`${dateString}T12:00:00`));
}

function formatTime(hour) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${suffix}`;
}

function formatEventRange(event) {
  const fmt = value => {
    const [h, m] = value.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
  };
  return `${fmt(event.start)} – ${fmt(event.end)}`;
}

function timeToMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function getDayIndex(dateString) {
  return new Date(`${dateString}T12:00:00`).getDay();
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return Math.round((end - start) / 86400000);
}

function isEventOnDate(event, dateString) {
  const repeat = event.repeat || 'weekly';
  const startDate = event.startDate || dateString;
  const diff = daysBetween(startDate, dateString);
  if (diff < 0) return false;

  if (repeat === 'none') return diff === 0;
  if (repeat === 'daily') return true;
  if (repeat === 'weekly') return diff % 7 === 0;
  if (repeat === 'biweekly') return diff % 14 === 0;

  const start = new Date(`${startDate}T12:00:00`);
  const current = new Date(`${dateString}T12:00:00`);
  if (repeat === 'monthly') {
    const months = (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth();
    return months >= 0 && current.getDate() === start.getDate();
  }
  if (repeat === 'yearly') {
    return current.getMonth() === start.getMonth() && current.getDate() === start.getDate();
  }
  return false;
}

function repeatLabel(event) {
  const labels = { none: 'Does not repeat', daily: 'Every day', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month', yearly: 'Every year' };
  return labels[event.repeat || 'weekly'];
}

function migrateSchedule(saved) {
  if (!Array.isArray(saved)) return [];
  return saved.map(event => {
    if (event.repeat || event.startDate) return event;
    const day = Number(event.day ?? 0);
    // Legacy events were weekly by weekday. Anchor them to the first matching
    // weekday on or before today so their existing behavior is preserved.
    const base = new Date(`${localDateString()}T12:00:00`);
    const delta = (base.getDay() - day + 7) % 7;
    base.setDate(base.getDate() - delta);
    return { ...event, repeat: 'weekly', startDate: base.toISOString().slice(0, 10) };
  });
}

async function geocodeLocation(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not find that location.');
  const data = await res.json();
  if (!data.results?.length) throw new Error('Location not found.');
  const r = data.results[0];
  return { name: `${r.name}${r.admin1 ? `, ${r.admin1}` : ''}`, latitude: r.latitude, longitude: r.longitude, timezone: r.timezone || 'auto' };
}

async function fetchWeather(location) {
  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit: 'fahrenheit',
    timezone: location.timezone === 'auto' ? 'auto' : location.timezone,
    forecast_days: '7'
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Weather service unavailable.');
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Weather service returned invalid data: ${text.slice(0, 120)}`);
  }
}

function loadSavedLocation() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_LOCATION; }
  catch { return DEFAULT_LOCATION; }
}

function loadSchedule() {
  try {
    const saved = JSON.parse(localStorage.getItem(SCHEDULE_KEY));
    return migrateSchedule(saved);
  } catch {
    return [];
  }
}

function App() {
  const today = localDateString();
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState(loadSavedLocation);
  const [weather, setWeather] = useState(null);
  const [schedule, setSchedule] = useState(loadSchedule);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationInput, setLocationInput] = useState(location.name);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', startDate: today, start: '09:00', end: '10:00', repeat: 'weekly' });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    setLocationInput(location.name);
  }, [location]);

  useEffect(() => {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchWeather(location)
      .then(data => !cancelled && setWeather(data))
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [location]);

  const weatherByHour = useMemo(() => {
    if (!weather?.hourly) return {};
    const out = {};
    weather.hourly.time.forEach((t, i) => {
      if (t.startsWith(date)) {
        const hour = Number(t.slice(11, 13));
        out[hour] = {
          temp: Math.round(weather.hourly.temperature_2m[i]),
          rain: weather.hourly.precipitation_probability[i],
          code: weather.hourly.weather_code[i]
        };
      }
    });
    return out;
  }, [weather, date]);

  const daily = useMemo(() => {
    if (!weather?.daily) return null;
    const i = weather.daily.time.indexOf(date);
    if (i < 0) return null;
    return {
      high: Math.round(weather.daily.temperature_2m_max[i]),
      low: Math.round(weather.daily.temperature_2m_min[i]),
      rain: weather.daily.precipitation_probability_max[i]
    };
  }, [weather, date]);

  const dayEvents = useMemo(() => {
    return schedule
      .filter(event => isEventOnDate(event, date))
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  }, [schedule, date]);

  const eventsForHour = hour => dayEvents.filter(event => {
    const start = timeToMinutes(event.start);
    const end = timeToMinutes(event.end);
    return start < (hour + 1) * 60 && end > hour * 60;
  });

  const openAddSchedule = () => {
    setEditingId(null);
    setForm({ title: '', startDate: date, start: '09:00', end: '10:00', repeat: 'weekly' });
    setScheduleOpen(true);
  };

  const editSchedule = event => {
    setEditingId(event.id);
    setForm({ title: event.title, startDate: event.startDate || date, start: event.start, end: event.end, repeat: event.repeat || 'weekly' });
    setScheduleOpen(true);
  };

  const saveSchedule = e => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (timeToMinutes(form.end) <= timeToMinutes(form.start)) {
      setError('The event end time must be after the start time.');
      return;
    }
    const item = { id: editingId || crypto.randomUUID(), title: form.title.trim(), startDate: form.startDate, start: form.start, end: form.end, repeat: form.repeat };
    if (!item.startDate) {
      setError('Please choose a start date.');
      return;
    }
    setSchedule(current => editingId ? current.map(event => event.id === editingId ? item : event) : [...current, item]);
    setScheduleOpen(false);
    setEditingId(null);
    setError('');
  };

  const deleteSchedule = id => {
    setSchedule(current => current.filter(event => event.id !== id));
  };

  const changeLocation = async e => {
    e.preventDefault();
    if (!locationInput.trim()) return;
    try {
      setError('');
      const result = await geocodeLocation(locationInput.trim());
      setLocation(result);
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Weather-Schedule</h1>
          <p className="subtitle">Your day, at a glance.</p>
        </div>
        <div className="top-actions">
          <button className="ghost-btn" onClick={() => setDate(today)}>Today</button>
          <button className="schedule-btn" onClick={openAddSchedule}>+ Add Event</button>
          <button className="icon-btn" onClick={() => setSettingsOpen(v => !v)} aria-label="Settings">⚙</button>
        </div>
      </header>

      {settingsOpen && (
        <section className="settings-card">
          <form onSubmit={changeLocation}>
            <label htmlFor="location">Weather location</label>
            <div className="location-row">
              <input id="location" value={locationInput} onChange={e => setLocationInput(e.target.value)} placeholder="City, State" />
              <button type="submit" className="primary-btn">Update</button>
            </div>
          </form>
          <p>Your schedule is stored locally in this browser. No Google account or Google Cloud setup is required.</p>
        </section>
      )}

      {scheduleOpen && (
        <section className="schedule-editor">
          <div className="editor-heading">
            <div>
              <h3>{editingId ? 'Edit Event' : 'Add Schedule Event'}</h3>
              <p>Choose when the event starts and how often it repeats.</p>
            </div>
            <button className="close-btn" onClick={() => setScheduleOpen(false)} aria-label="Close">×</button>
          </div>
          <form onSubmit={saveSchedule} className="event-form">
            <label>Event name<input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Class, work, appointment…" /></label>
            <label>Starts<input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></label>
            <label>Repeat<select value={form.repeat} onChange={e => setForm({ ...form, repeat: e.target.value })}>
              <option value="none">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Every month</option>
              <option value="yearly">Every year</option>
            </select></label>
            <label>Start<input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} /></label>
            <label>End<input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} /></label>
            <div className="editor-actions">
              <button type="submit" className="primary-btn">{editingId ? 'Save Changes' : 'Add Event'}</button>
              <button type="button" className="ghost-btn" onClick={() => setScheduleOpen(false)}>Cancel</button>
            </div>
          </form>
          {schedule.length > 0 && (
            <div className="event-list">
              <h4>Your schedule</h4>
              {schedule.slice().sort((a, b) => Number(a.day) - Number(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start)).map(event => (
                <div className="saved-event" key={event.id}>
                  <div><strong>{event.title}</strong><small>Starts {event.startDate} · {repeatLabel(event)} · {formatEventRange(event)}</small></div>
                  <div className="saved-actions"><button onClick={() => editSchedule(event)}>Edit</button><button onClick={() => deleteSchedule(event.id)}>Delete</button></div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {error && <div className="error-banner">{error}<button onClick={() => setError('')}>×</button></div>}

      <main>
        <section className="day-heading">
          <div>
            <div className="date-nav">
              <button onClick={() => setDate(d => addDays(d, -1))} aria-label="Previous day">‹</button>
              <h2>{formatLongDate(date)}</h2>
              <button onClick={() => setDate(d => addDays(d, 1))} aria-label="Next day">›</button>
            </div>
            <div className="meta-line">
              <span>Location: {location.name}</span>
              {daily && <span>High {daily.high}° / Low {daily.low}° / Max rain {daily.rain}%</span>}
              <span>{dayEvents.length} scheduled {dayEvents.length === 1 ? 'event' : 'events'}</span>
            </div>
          </div>
          <button className="connect-inline" onClick={openAddSchedule}>Manage schedule →</button>
        </section>

        <div className="schedule-table">
          <div className="table-head"><div>Time</div><div>Weather</div><div>Schedule</div></div>

          {Array.from({ length: 24 }, (_, hour) => {
            const w = weatherByHour[hour];
            const hourlyEvents = eventsForHour(hour);
            const [label, icon] = weatherLabels[w?.code] || ['Weather unavailable', '—'];
            return (
              <div className={`schedule-row ${hour === new Date().getHours() && date === today ? 'current' : ''}`} key={hour}>
                <div className="time-cell">{formatTime(hour)}</div>
                <div className="weather-cell">
                  {loading ? <span className="muted">Loading…</span> : w ? <><strong>{w.temp}°</strong><span className="weather-icon" title={label}>{icon}</span><span className="rain">({w.rain ?? 0}%)</span></> : <span className="muted">—</span>}
                </div>
                <div className="calendar-cell">
                  {hourlyEvents.length ? hourlyEvents.map(event => <EventChip key={event.id} event={event} onEdit={() => editSchedule(event)} onDelete={() => deleteSchedule(event.id)} />) : <span className="empty"> </span>}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer>
        <span>Weather-Schedule</span>
        <span>Weather data: Open-Meteo · Schedule stored locally</span>
      </footer>
    </div>
  );
}

function EventChip({ event, onEdit, onDelete }) {
  return (
    <div className="event-chip">
      <strong>{event.title}</strong>
      <small>{formatEventRange(event)}</small>
      <div className="chip-actions"><button onClick={onEdit}>Edit</button><button onClick={onDelete}>×</button></div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
