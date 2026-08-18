window.APPOINTMENT_DEV_CONFIG = {
  build: "2026.08.18-round177-production-readiness-gate",
  profileName: "ส่วนกลาง",

  controls: {
    moduleEnabled: true,
    uploadEnabled: true,
    useImportedData: false,
    matchTestEnabled: true,
    integrationSimulatorEnabled: true,
    preProductionAdapterEnabled: true,
    productionReadinessEnabled: true
  },

  sheetName: "raw_data",
  sheetAliases: ["RAW_DATA", "Raw Data"],
  warehouse: {
    field: "dc",
    matchMode: "STARTS_WITH",
    values: ["906"]
  },

  timeReference: "PERIOD",

  matching: {
    searchWindowHours: 36,
    lookupTargetMs: 150,
    adapterTimeoutMs: 250,
    failOpen: true
  },

  productionRollout: {
    defaultUseImportedData: false,
    shadowMode: true,
    writeProduction: false,
    requiredContractVersion: "gate-appointment-v3-preprod",
    requiredDateTimeFormat: "dd/MM/yyyy HH:mm:ss",
    mainVehicleFields: ["auto_id","appointment_no","gate_in_at","company_name","driver_name","vehicle_plate","province","vehicle_type"],
    queryBudgetSamples: 3
  },

  date: {
    timezone: "Asia/Bangkok",
    displayDateFormat: "dd/MM/yyyy",
    displayDateTimeFormat: "dd/MM/yyyy HH:mm:ss",
    dateSystem: "AUTO",
    rejectAmbiguous: true,
    acceptedTextFormats: ["DD.MM.YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]
  },

  fields: {
    dc:          { label: "รหัสคลัง",          header: "DC CODE",   aliases: [] },
    date:        { label: "วันที่นัด",          header: "DATE",      aliases: [] },
    period:      { label: "รอบนัดหมาย",        header: "PERIOD",    aliases: [] },
    from:        { label: "เวลาเริ่ม",          header: "FROM",      aliases: [] },
    to:          { label: "เวลาสิ้นสุด",        header: "TO",        aliases: [] },
    po:          { label: "เลข PO",             header: "PO NBR",    aliases: [] },
    appointment: { label: "เลข Appointment",    header: "APPTNBR",   aliases: [] },
    vendor:      { label: "บริษัท / Vendor",    header: "VEND NAME", aliases: ["VENDOR NAME"] },
    carrier:     { label: "Carrier / ผู้ขนส่ง", header: "CARR",      aliases: ["CARRIER"] }
  },

  display: {
    showPeriod: true,
    showFrom: true,
    showTo: true,
    showVendor: true,
    showCarrier: true,
    showPo: true
  },

  displayTargets: {
    inbound:   { enabled: true,  timing: true,  vendor: true,  carrier: false, po: false },
    receiving: { enabled: true,  timing: true,  vendor: true,  carrier: true,  po: true  },
    datatable: { enabled: true,  timing: true,  vendor: true,  carrier: true,  po: true  },
    dashboard: { enabled: true,  timing: true,  vendor: false, carrier: false, po: false },
    queue:     { enabled: true,  timing: true,  vendor: false, carrier: false, po: false },
    track:     { enabled: true,  timing: true,  vendor: true,  carrier: false, po: false }
  },

  importApi: {
    enabled: true,
    baseUrl: "https://warehouse-appointment-dev.somchaibutphon.workers.dev",
    batchSize: 50
  }
};
