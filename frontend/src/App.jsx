import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMediaQuery } from '@mantine/hooks'
import { ActionIcon, Alert, Box, Button, Divider, Drawer, Group, Loader, NativeSelect, Paper, SegmentedControl, Stack, Switch, Text, TextInput, Title, Tooltip } from '@mantine/core'
import { IconAdjustmentsHorizontal, IconAlertCircle, IconArrowsExchange, IconCalendar, IconClock, IconInfoCircle, IconMap, IconMenu2, IconTrain, IconX } from '@tabler/icons-react'
import { api, journeyPath } from './api.js'
import { StationPicker } from './components/StationPicker.jsx'
import { JourneyResults } from './components/JourneyResults.jsx'
import { MapView } from './components/MapView.jsx'
import { belgianNow, futureDepartureValid, clampToFuture } from './travelDate.js'
import { initialState, plannerReducer } from './plannerState.js'

const EMPTY = { type: 'FeatureCollection', features: [] }
const LANGUAGES = [{ value: 'nl', label: 'Nederlands' }, { value: 'fr', label: 'Français' }, { value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]

function Planner({ state, dispatch, feed, clockNow, invalidReason, journeyQuery, active, setActive }) {
  const { language, from, to, via, date, time, target } = state
  const today = clockNow.date
  const minDate = feed?.feed?.start_date && feed.feed.start_date > today ? feed.feed.start_date : today
  const maxDate = feed?.feed?.end_date
  const setDate = (nextDate) => {
    const adjusted = clampToFuture(nextDate, time, belgianNow())
    dispatch({ type: 'dates', value: adjusted })
  }
  const setTime = (nextTime) => {
    const adjusted = clampToFuture(date, nextTime, belgianNow())
    dispatch({ type: 'dates', value: adjusted })
  }
  const onExample = async (destination) => {
    dispatch({ type: 'example-error', value: null })
    try {
      const [origins, destinations] = await Promise.all([
        api(`/api/gtfs/stations?search=Leuven&limit=30&lang=${language}`),
        api(`/api/gtfs/stations?search=${encodeURIComponent(destination)}&limit=30&lang=${language}`),
      ])
      const origin = origins.find(s => s.id === 'gs:nmbssncb:S8833001') || origins[0]
      const arrival = destinations.find(s => s.name.toLowerCase() === destination.toLowerCase() || s.original_name?.toLowerCase() === destination.toLowerCase()) || destinations[0]
      if (!origin || !arrival) throw new Error('Voorbeeldstations niet gevonden in de GTFS-dataset.')
      dispatch({ type: 'example', value: { from: origin, to: arrival } })
    } catch (error) { dispatch({ type: 'example-error', value: error.message }) }
  }
  return <Stack gap="lg" className="planner-content">
    <Box>
      <Text className="eyebrow" mb={5}>ROUTEPLANNER</Text>
      <Title order={2} size="h3">Plan je treinreis</Title>
      <Text c="dimmed" size="sm" mt={5}>Vergelijk geplande treinreizen op de Belgische spoorwegkaart.</Text>
    </Box>
    <Stack gap="sm">
      <NativeSelect label="Stationsnamen" data={LANGUAGES} value={language} onChange={e => dispatch({ type: 'language', value: e.currentTarget.value })}/>
      <StationPicker label="Vertrekstation" placeholder="Zoek een station" language={language} value={from} onChange={value => dispatch({ type: 'station', field: 'from', value })} onFocus={() => dispatch({ type: 'target', value: 'from' })}/>
      <Group justify="center" className="swap-row">
        <Tooltip label="Vertrek en aankomst omwisselen"><ActionIcon size="lg" color="gray" variant="light" aria-label="Vertrek en aankomst omwisselen" onClick={() => dispatch({ type: 'swap' })}><IconArrowsExchange size={17}/></ActionIcon></Tooltip>
      </Group>
      <StationPicker label="Aankomststation" placeholder="Zoek je bestemming" language={language} value={to} onChange={value => dispatch({ type: 'station', field: 'to', value })} onFocus={() => dispatch({ type: 'target', value: 'to' })}/>
      <StationPicker label="Overstappen in (optioneel)" placeholder="Bijvoorbeeld Bordet" language={language} value={via} onChange={value => dispatch({ type: 'station', field: 'via', value })} onFocus={() => dispatch({ type: 'target', value: 'via' })}/>
      <Text size="xs" c="dimmed">Een overstap is een echte wissel tussen twee treinritten, geen spoorlijn die via dat station loopt.</Text>
    </Stack>
    <Group grow align="start" gap="sm" className="date-row">
      <TextInput label="Reisdatum" type="date" value={date} min={minDate} max={maxDate || undefined} leftSection={<IconCalendar size={17}/>} onChange={e => setDate(e.currentTarget.value)}/>
      <TextInput label="Vertrek vanaf" type="time" value={time} min={date === today ? clockNow.time : undefined} leftSection={<IconClock size={17}/>} onChange={e => setTime(e.currentTarget.value)}/>
    </Group>
    <Box>
      <Text size="xs" fw={600} c="dimmed" mb={7}>Kaartklik selecteert</Text>
      <SegmentedControl fullWidth size="xs" value={target} onChange={value => dispatch({ type: 'target', value })} data={[{ label: 'Vertrek', value: 'from' }, { label: 'Aankomst', value: 'to' }, { label: 'Overstap', value: 'via' }]}/>
    </Box>
    <Group grow gap="xs" className="examples">
      <Button variant="light" color="blue" size="sm" onClick={() => onExample('Weerde')} disabled={!feed?.available}>Leuven → Weerde</Button>
      <Button variant="light" color="blue" size="sm" onClick={() => onExample('Sint-Katelijne-Waver')} disabled={!feed?.available}>Leuven → Sint-Katelijne-Waver</Button>
    </Group>
    {state.exampleError && <Alert color="red" title="Voorbeeld niet geladen" icon={<IconAlertCircle size={16}/>} onClose={() => dispatch({ type: 'example-error', value: null })} withCloseButton>{state.exampleError}</Alert>}
    <Divider color="gray.3"/>
    <JourneyResults from={from} to={to} via={via} invalidReason={invalidReason} journeyQuery={journeyQuery} active={active} setActive={setActive}/>
    <Text size="xs" c="dimmed" className="data-note">Bronnen: Infrabel Open Data · NMBS GTFS Static · iRail. Geen realtimegegevens of bevestiging van ticketgeldigheid. Routegeometrie is een benadering.</Text>
  </Stack>
}


export default function App() {
  const isMobile = useMediaQuery('(max-width: 860px)')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(true)
  const [state, dispatch] = React.useReducer(plannerReducer, initialState)
  const [clockNow, setClockNow] = useState(belgianNow)
  const [active, setActive] = useState(0)
  const [networkVisible, setNetworkVisible] = useState(true)
  const [journeyVisible, setJourneyVisible] = useState(true)
  const [stationsVisible, setStationsVisible] = useState(true)
  const meta = useQuery({ queryKey: ['meta'], queryFn: ({ signal }) => api('/api/meta', { signal }), staleTime: 3600000, retry: 1 })
  const feed = useQuery({ queryKey: ['feed'], queryFn: ({ signal }) => api('/api/gtfs/meta', { signal }), staleTime: 300000, retry: 1 })
  const network = useQuery({ queryKey: ['network'], queryFn: ({ signal }) => api('/api/network', { signal }), staleTime: 86400000, retry: 1 })
  const stops = useQuery({ queryKey: ['stops', state.language], queryFn: ({ signal }) => api(`/api/gtfs/stations/geojson?lang=${state.language}`, { signal }), staleTime: 86400000, retry: 1 })
  useEffect(() => {
    const timer = setInterval(() => setClockNow(belgianNow()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const adjusted = clampToFuture(state.date, state.time, clockNow)
    if (adjusted.date !== state.date || adjusted.time !== state.time) dispatch({ type: 'dates', value: adjusted })
  }, [clockNow, state.date, state.time])
  useEffect(() => {
    if (!stops.data?.features?.length) return
    const names = new Map(stops.data.features.map(f => [f.properties.id, f.properties.name]))
    dispatch({ type: 'localized', value: names })
  }, [stops.data])
  const { from, to, via, date, time, language } = state
  const feedExpired = !!(feed.data?.feed?.end_date && feed.data.feed.end_date < clockNow.date)
  const tooLate = !futureDepartureValid(date, time, clockNow)
  const invalidReason = feed.isError ? 'De dienstregeling is niet bereikbaar.' :
    !feed.data?.available ? 'Er is nog geen NMBS-dienstregeling geïmporteerd.' :
    feedExpired ? 'De dienstregeling is verlopen. Importeer een recente GTFS-feed.' :
    date > feed.data.feed.end_date || date < feed.data.feed.start_date ? 'Deze datum valt buiten de geïmporteerde dienstregeling.' :
    tooLate ? 'Kies een vertrekdatum en tijd in de toekomst.' :
    from && to && from.id === to.id ? 'Vertrek- en aankomststation zijn hetzelfde.' : null
  const ready = !!(from && to && !invalidReason)
  const journeys = useQuery({
    queryKey: ['journeys', from?.id, to?.id, date, time, language, via?.id],
    queryFn: ({ signal }) => api(journeyPath({ from: from.id, to: to.id, date, time, language, via: via?.id }), { signal }),
    enabled: ready,
    staleTime: 120000,
    retry: false,
  })
  const availableRoutes = ready && journeys.data?.journeys || []
  useEffect(() => setActive(0), [from?.id, to?.id, via?.id, date, time, language])
  const onMapPick = (station, target) => dispatch({ type: 'station', field: target, value: station })
  const plannerProps = { state, dispatch, feed: feed.data, clockNow, invalidReason, journeyQuery: journeys, active, setActive }
  const dataError = [meta, feed, network, stops].find(q => q.isError)?.error

  return <div className="application">
    <header className="app-header">
      <Group gap="sm" wrap="nowrap">
        {isMobile && <ActionIcon size="lg" variant="light" color="dark" aria-label="Open reisplanner" onClick={() => setDrawerOpen(true)}><IconMenu2 size={21}/></ActionIcon>}
        <span className="brand-symbol"><IconTrain size={21} stroke={1.9}/></span>
        <Box><Text fw={760} lh={1.05} size="md">Railway Explorer</Text><Text c="dimmed" size="xs" mt={2}>Belgisch spoorwegnet</Text></Box>
      </Group>
      <Group gap="sm">
        {feed.data?.available && !feedExpired ? <Text className="feed-status" size="xs">Geplande dienstregeling</Text> : <Text c="red" size="xs">Dienstregeling niet beschikbaar</Text>}
        {isMobile && <Button size="xs" variant="filled" leftSection={<IconMap size={16}/>} onClick={() => setDrawerOpen(true)}>Plan reis</Button>}
      </Group>
    </header>
    <div className="workspace">
      {!isMobile && <aside className="planner-sidebar" aria-label="Reisplanner"><Planner {...plannerProps}/></aside>}
      <main className="map-panel" aria-label="Spoorwegkaart">
        <MapView allSegments={network.data || EMPTY} allStations={stops.data || EMPTY} routes={availableRoutes} active={active}
          selected={[from, to, via]} onStationPick={onMapPick} target={state.target}
          showNetwork={networkVisible} showJourney={journeyVisible} showStations={stationsVisible}/>
        <Paper className="map-source" shadow="sm" radius="md" p="xs"><Group gap={7}><IconMap size={16}/><Text fw={600} size="xs">NMBS · Infrabel</Text></Group></Paper>
        <Paper className="map-layer-panel" radius="md" shadow="sm" p="sm">
          <Group justify="space-between" gap="xs" mb={layersOpen ? 'xs' : 0}>
            <Group gap={6}><IconAdjustmentsHorizontal size={17}/><Text size="xs" fw={650}>Kaartlagen</Text></Group>
            <ActionIcon variant="subtle" color="dark" size="xs" aria-label={layersOpen ? 'Verberg kaartlagen' : 'Toon kaartlagen'} aria-expanded={layersOpen} onClick={() => setLayersOpen(!layersOpen)}>{layersOpen ? <IconX size={16}/> : <IconAdjustmentsHorizontal size={16}/>}</ActionIcon>
          </Group>
          {layersOpen && <Stack gap="xs">
            <Switch label="Spoorwegen" size="xs" checked={networkVisible} onChange={e => setNetworkVisible(e.currentTarget.checked)}/>
            <Switch label="Geplande route" size="xs" checked={journeyVisible} onChange={e => setJourneyVisible(e.currentTarget.checked)}/>
            <Switch label="Stations" size="xs" checked={stationsVisible} onChange={e => setStationsVisible(e.currentTarget.checked)}/>
          </Stack>}
        </Paper>
        {dataError && <Alert className="map-error" color="red" variant="filled" icon={<IconAlertCircle size={17}/>} title="Kaartgegevens niet beschikbaar">{dataError.message}</Alert>}
      </main>
    </div>
    <Drawer opened={!!isMobile && drawerOpen} onClose={() => setDrawerOpen(false)} title="Railway Explorer" size="min(420px, 100%)" padding="lg" className="mobile-drawer" overlayProps={{ opacity: 0.3 }}><Planner {...plannerProps}/></Drawer>
  </div>
}
