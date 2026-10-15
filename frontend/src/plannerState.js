import { initialDeparture } from './travelDate.js'

const initial = initialDeparture()
export const initialState = { language: 'nl', from: null, to: null, via: null, target: 'from', date: initial.date, time: initial.time, exampleError: null }

export function plannerReducer(state, action) {
  switch (action.type) {
    case 'language': return { ...state, language: action.value }
    case 'station': return { ...state, [action.field]: action.value }
    case 'target': return { ...state, target: action.value }
    case 'dates': return { ...state, date: action.value.date, time: action.value.time }
    case 'swap': return { ...state, from: state.to, to: state.from }
    case 'example': return { ...state, from: action.value.from, to: action.value.to, via: null, target: 'from' }
    case 'example-error': return { ...state, exampleError: action.value }
    case 'localized': {
      const names = action.value
      const rename = s => s && names.has(s.id) ? { ...s, name: names.get(s.id) } : s
      return { ...state, from: rename(state.from), to: rename(state.to), via: rename(state.via) }
    }
    default: return state
  }
}

