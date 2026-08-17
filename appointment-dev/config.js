window.APPOINTMENT_DEV_CONFIG = {
  build: "2026.08.18-round170-snapshot-version-guard",
  profileName: "ส่วนกลาง",

  controls: {
    moduleEnabled: true,
    uploadEnabled: true,
    useImportedData: false
  },

  sheetName: "raw_data",
  sheetAliases: ["RAW_DATA", "Raw Data"],
  warehouse: {
    field: "dc",
    matchMode: "STARTS_WITH",
    values: ["906"]
  },

  timeReference: "PERIOD",
  date: {
    timezone: "Asia/Bangkok",
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

  importApi: {
    enabled: true,
    baseUrl: "https://warehouse-appointment-dev.somchaibutphon.workers.dev",
    batchSize: 50
  }
};
