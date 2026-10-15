import React, { useState } from 'react'
import { ActionIcon, Combobox, Group, Loader, Text, TextInput, useCombobox } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconMapPin, IconX } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api, stationSearchPath } from '../api.js'

export function StationPicker({ label, placeholder, value, onChange, onFocus, language = 'nl' }) {
  const [typed, setTyped] = useState('')
  const search = value?.name ?? typed
  const [debounced] = useDebouncedValue(search.trim(), 250)
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })
  const [open, setOpen] = useState(false)

  const matches = useQuery({
    queryKey: ['station-search', debounced, language],
    queryFn: ({ signal }) => api(stationSearchPath(debounced, language), { signal }),
    enabled: open && !value && debounced.length >= 2,
    staleTime: 120000,
    retry: 1,
  })
  const options = matches.data || []
  const choose = (id) => {
    const station = options.find(x => x.id === id)
    if (!station) return
    onChange(station)
    setTyped('')
    combobox.closeDropdown()
    setOpen(false)
  }

  return <Combobox store={combobox} onOptionSubmit={choose} position="bottom-start" shadow="md">
    <Combobox.Target>
      <TextInput label={label} placeholder={placeholder} leftSection={<IconMapPin size={17} stroke={1.7} />}
        value={search} autoComplete="off" className="station-field"
        onFocus={() => { if (!value) { setOpen(true); combobox.openDropdown() }; onFocus?.() }}
        onClick={() => { if (!value) { setOpen(true); combobox.openDropdown() } }}
        onChange={(event) => { setTyped(event.currentTarget.value); if (value) onChange(null); setOpen(true); combobox.openDropdown(); combobox.updateSelectedOptionIndex() }}
        rightSection={value ? <ActionIcon aria-label={`${label} wissen`} title="Station wissen" variant="subtle" color="gray" onMouseDown={e => e.preventDefault()} onClick={() => { setTyped(''); onChange(null); setOpen(true); combobox.openDropdown() }}><IconX size={17}/></ActionIcon> : matches.isFetching ? <Loader size="xs"/> : null}
      />
    </Combobox.Target>
    <Combobox.Dropdown>
      <Combobox.Options mah={270} style={{ overflowY: 'auto' }}>
        {debounced.length < 2 && <Combobox.Empty>Typ minstens twee letters.</Combobox.Empty>}
        {debounced.length >= 2 && matches.isFetching && <Combobox.Empty>Stations zoeken…</Combobox.Empty>}
        {debounced.length >= 2 && matches.isError && <Combobox.Empty>Zoeken mislukt: {matches.error.message}</Combobox.Empty>}
        {debounced.length >= 2 && matches.isSuccess && options.length === 0 && <Combobox.Empty>Geen stations gevonden.</Combobox.Empty>}
        {!matches.isFetching && options.map(station => <Combobox.Option key={station.id} value={station.id}>
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="sm" fw={550}>{station.name}</Text>
            {station.original_name && station.original_name !== station.name && <Text c="dimmed" size="xs" truncate>{station.original_name}</Text>}
          </Group>
        </Combobox.Option>)}
      </Combobox.Options>
    </Combobox.Dropdown>
  </Combobox>
}
