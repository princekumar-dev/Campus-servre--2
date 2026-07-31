export const UNIT_GROUPS = [
  { label: 'Count and packaging', options: [
    ['pcs', 'Pieces (pcs)'], ['unit', 'Units'], ['set', 'Sets'], ['pair', 'Pairs'], ['dozen', 'Dozen'],
    ['pack', 'Packs'], ['box', 'Boxes'], ['carton', 'Cartons'], ['roll', 'Rolls'], ['bundle', 'Bundles'], ['lot', 'Lots']
  ] },
  { label: 'Length', options: [
    ['mm', 'Millimetres (mm)'], ['cm', 'Centimetres (cm)'], ['m', 'Metres (m)'], ['km', 'Kilometres (km)'],
    ['in', 'Inches (in)'], ['ft', 'Feet (ft)'], ['yd', 'Yards (yd)']
  ] },
  { label: 'Area', options: [
    ['mm2', 'Square millimetres (mm²)'], ['cm2', 'Square centimetres (cm²)'], ['m2', 'Square metres (m²)'], ['ft2', 'Square feet (ft²)']
  ] },
  { label: 'Volume', options: [
    ['ml', 'Millilitres (mL)'], ['l', 'Litres (L)'], ['m3', 'Cubic metres (m³)'], ['ft3', 'Cubic feet (ft³)']
  ] },
  { label: 'Weight', options: [
    ['mg', 'Milligrams (mg)'], ['g', 'Grams (g)'], ['kg', 'Kilograms (kg)'], ['t', 'Tonnes (t)'], ['lb', 'Pounds (lb)']
  ] },
  { label: 'Time and service', options: [
    ['min', 'Minutes'], ['hour', 'Hours'], ['day', 'Days'], ['month', 'Months'],
    ['service', 'Service'], ['job', 'Job'], ['visit', 'Visit'], ['license', 'Licence']
  ] },
  { label: 'Electrical capacity', options: [
    ['w', 'Watts (W)'], ['kw', 'Kilowatts (kW)'], ['va', 'Volt-amperes (VA)'], ['kva', 'Kilovolt-amperes (kVA)']
  ] }
]

export function UnitOptions() {
  return UNIT_GROUPS.map(group => createElement(
    'optgroup',
    { key: group.label, label: group.label },
    group.options.map(([value, label]) => createElement('option', { key: value, value }, label))
  ))
}

const LEGACY_UNITS = { pieces: 'pcs', sets: 'set', units: 'unit', boxes: 'box', meters: 'm' }
export const normalizeUnit = value => LEGACY_UNITS[String(value || '').toLowerCase()] || String(value || 'pcs').toLowerCase()
import { createElement } from 'react'
