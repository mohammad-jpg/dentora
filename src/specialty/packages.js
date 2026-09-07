// Specialty add-on packages. Toggled per clinic in Settings; gates tabs, pages and nav.
export const PACKAGES = {
  ortho: {
    key: 'ortho',
    name: 'Orthodontics',
    price: 129,
    blurb: 'Fixed-appliance and aligner case records, archwire and tray tracking, IOTN assessment, retention, and instalment payment plans with overdue tracking.',
  },
  endo: {
    key: 'endo',
    name: 'Endodontics',
    price: 89,
    blurb: 'Per-tooth root canal case records: pulpal and apical diagnosis, vitality tests, per-canal working lengths and MAF, obturation, complications, healing reviews and a one-click report to the referring dentist.',
  },
}

export const hasPackage = (clinic, key) => Array.isArray(clinic?.addons) && clinic.addons.includes(key)
