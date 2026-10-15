import React from 'react'
import { Accordion, Alert, Box, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowRight, IconInfoCircle, IconRoute } from '@tabler/icons-react'

const COLORS = ['#2463c5', '#dc8c3a', '#865abd', '#1e9e8b', '#c45a76']

export function JourneyResults({ from, to, via, journeyQuery, active, setActive, invalidReason }) {
  const journeys = journeyQuery.data?.journeys || []
  return <section aria-labelledby="journey-title" className="results-section">
    <Group justify="space-between" mb="sm">
      <Title order={3} size="h4" id="journey-title">Reisopties</Title>
      {journeys.length > 0 && <Text c="dimmed" size="xs">{journeys.length} gevonden</Text>}
    </Group>
    {invalidReason && <Alert icon={<IconInfoCircle size={17}/>} color="yellow" variant="light" mb="sm">{invalidReason}</Alert>}
    {!from || !to ? <Paper withBorder p="lg" radius="md" className="empty-results"><IconRoute size={25} stroke={1.6}/><Text fw={600} mt="xs">Kies je vertrek- en aankomststation</Text><Text c="dimmed" size="sm">We tonen geplande treinen en overstappen op de kaart.</Text></Paper> : null}
    {from && to && !invalidReason && journeyQuery.isFetching && <Group p="lg" justify="center"><Loader size="sm" /><Text size="sm" c="dimmed">Dienstregeling raadplegen…</Text></Group>}
    {journeyQuery.isError && !invalidReason && <Alert icon={<IconAlertCircle size={17}/>} color="red" title="Routeberekening mislukt">{journeyQuery.error.message}</Alert>}
    {from && to && !invalidReason && journeyQuery.isSuccess && journeys.length === 0 && <Alert color="gray" icon={<IconInfoCircle size={17}/>} title="Geen reis gevonden">{via ? `Geen reis met een overstap in ${via.name} gevonden binnen het zoekvenster.` : 'Geen geplande verbinding gevonden in het zoekvenster.'} Probeer een later uur of een andere datum.</Alert>}
    <Stack gap="sm">
      {journeys.map((journey, i) => <Paper key={`${journey.departure}-${i}`} className={`journey-card ${active === i ? 'journey-active' : ''}`} withBorder radius="md">
        <button type="button" className="journey-select" onClick={() => setActive(i)} aria-pressed={active === i} aria-label={`Toon reis ${journey.departure} tot ${journey.arrival} op de kaart`}>
          <span className="journey-marker" style={{ background: COLORS[i] }}/>
          <span className="journey-text"><strong>{journey.departure} <IconArrowRight size={15} stroke={1.7} aria-hidden="true"/> {journey.arrival}</strong>
            <small>{journey.transfer_count === 0 ? 'Rechtstreeks' : `${journey.transfer_count} overstap${journey.transfer_count === 1 ? '' : 'pen'} · ${journey.transfer_stations.join(', ')}`}</small></span>
          <span className="journey-trains">{journey.legs.length} trein{journey.legs.length === 1 ? '' : 'en'}</span>
        </button>
        {active === i && <Box className="journey-detail">
          <Accordion variant="contained" radius="sm" chevronPosition="right">
            <Accordion.Item value="legs"><Accordion.Control>Bekijk treinen en haltes</Accordion.Control>
              <Accordion.Panel><Stack gap="md">{journey.legs.map((leg, j) => <Box key={`${leg.trip_id}-${j}`}>
                <Text fw={650} size="sm">{leg.departure} {leg.from_name} → {leg.arrival} {leg.to_name}</Text>
                <Text size="xs" c="dimmed">{leg.route || 'Trein'}{leg.headsign ? ` · richting ${leg.headsign}` : ''}</Text>
                {leg.stop_names?.length > 2 && <Text mt={4} size="xs" c="dimmed">Via: {leg.stop_names.slice(1, -1).join(' · ')}</Text>}
                {j < journey.legs.length - 1 && <Text mt={5} size="xs" fw={650} c="orange.7">Overstap in {leg.to_name}</Text>}
              </Box>)}</Stack></Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          {journey.geometry_quality?.schematic_fallbacks > 0 && <Text mt="xs" c="dimmed" size="xs">{journey.geometry_quality.schematic_fallbacks} trajectdelen zijn een gestippelde schatting.</Text>}
        </Box>}
      </Paper>)}
    </Stack>
  </section>
}
