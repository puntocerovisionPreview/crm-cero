import { useEffect, useState } from 'react';
import { Prospect, ProspectEvent, ProspectingSettings } from '../types';
import { DEFAULT_PROSPECTING_SETTINGS } from './core';
import { subscribeProspectEvents, subscribeProspectingSettings, subscribeProspects } from './store';
import { todayLocal } from '../utils/dates';

// Datos de prospección en vivo (Firestore) + "hoy" que se actualiza a la medianoche
export function useProspecting() {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [events, setEvents] = useState<ProspectEvent[]>([]);
  const [settings, setSettings] = useState<ProspectingSettings>(DEFAULT_PROSPECTING_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [today, setToday] = useState(todayLocal());
  const [hour, setHour] = useState(new Date().getHours());

  useEffect(
    () =>
      subscribeProspects(
        (items) => {
          setProspects(items);
          setLoadError(null);
        },
        (err) => setLoadError(err.message)
      ),
    []
  );
  useEffect(() => subscribeProspectEvents(items => { setEvents(items); setEventsLoaded(true); setEventsError(null); }, err => { setEventsError(err.message); setEventsLoaded(true); }), []);
  useEffect(
    () =>
      subscribeProspectingSettings((s) => {
        setSettings(s);
        setSettingsLoaded(true);
      }),
    []
  );
  useEffect(() => {
    const id = setInterval(() => {
      setToday(todayLocal());
      setHour(new Date().getHours());
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return { prospects, setProspects, events, eventsLoaded, eventsError, settings, settingsLoaded, today, hour, loadError };
}
