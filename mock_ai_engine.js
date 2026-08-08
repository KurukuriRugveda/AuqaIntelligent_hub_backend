const { v4: uuidv4 } = require('uuid');

// Define document types
const DOCUMENT_TYPES = {
  STOCKING: 'Stocking Certificate',
  FEEDING: 'Feeding Log Sheet',
  WATER_QUALITY: 'Water Quality Log',
  HARVEST_LANDING: 'Landing Declaration',
  GRADING: 'Grading Certificate',
  COLD_STORAGE: 'Cold Storage Log',
  PROCESSING: 'Processing Batch Sheet',
  SALES: 'Sales Invoice'
};

// Standard operational thresholds
const THRESHOLDS = {
  WATER_QUALITY: {
    PH_MIN: 6.5,
    PH_MAX: 8.5,
    DO_MIN: 5.0, // mg/L
    AMMONIA_MAX: 0.05, // mg/L
    TEMP_MIN: 12.0, // °C
    TEMP_MAX: 24.0 // °C
  },
  COLD_STORAGE: {
    TEMP_MAX: -18.0 // °C (must be colder than or equal to -18°C)
  },
  FEEDING: {
    FCR_MIN: 0.8,
    FCR_MAX: 1.7,
    MORTALITY_MAX: 0.15 // % per day
  },
  HARVEST_LANDING: {
    QUOTA_MAX_KG: 15000
  },
  GRADING: {
    FRESHNESS_MIN: 75.0, // percentage score
    DEFECT_MAX: 8.0 // percentage
  }
};

// Preset mock documents that the user can choose to "ingest"
const MOCK_TEMPLATES = [
  {
    id: "temp-stock-001",
    fileName: "stocking_cert_hatchery_2026_08_02.pdf",
    type: DOCUMENT_TYPES.STOCKING,
    facility: "North Delta Hatchery (Tank 4)",
    uploader: "Hatchery Supervisor (Lucas Miller)",
    content: {
      batchId: "BATCH-2026-SAL-09",
      species: "Atlantic Salmon (Salmo salar)",
      fryCount: 45000,
      averageWeightG: 45.2,
      supplier: "Superior Smolt Hatchery Ltd.",
      transportMortalityPercent: 1.2,
      healthCertificateStatus: "Certified Disease Free (IPN & ISA Clear)",
      inspectorSignOff: "Dr. Evelyn Vance"
    }
  },
  {
    id: "temp-stock-002",
    fileName: "stocking_hatchery_batch_error.pdf",
    type: DOCUMENT_TYPES.STOCKING,
    facility: "South Delta Hatchery (Tank 2)",
    uploader: "Hatchery Assistant (Lucas Miller)",
    content: {
      batchId: "BATCH-2026-SAL-10",
      species: "Atlantic Salmon (Salmo salar)",
      fryCount: 52000,
      averageWeightG: 38.5,
      supplier: "Global Smolt Corp",
      transportMortalityPercent: 6.8, // Flagged: high transport mortality (> 5%)
      healthCertificateStatus: "Pending final PCR results", // Flagged: pending certificate
      inspectorSignOff: "None (Self-Certified)"
    }
  },
  {
    id: "temp-feed-001",
    fileName: "daily_feed_log_pen_6B.xlsx",
    type: DOCUMENT_TYPES.FEEDING,
    facility: "Ocean Pen 6B (Marine Site A)",
    uploader: "Lead Farmer (Marcus Chen)",
    content: {
      logDate: "2026-08-06",
      feedBrand: "Skretting Nutra RC 4.0",
      quantityFedKg: 1250,
      biomassEstKg: 85000,
      feedConversionRatio: 1.15, // Normal
      dailyMortalityCount: 22,
      dailyMortalityPercent: 0.02, // Normal
      feedBatchNumber: "SKR-90812-A"
    }
  },
  {
    id: "temp-feed-002",
    fileName: "feed_anomaly_log_pen_12A.xlsx",
    type: DOCUMENT_TYPES.FEEDING,
    facility: "Ocean Pen 12A (Marine Site B)",
    uploader: "Assistant Farmer (Tim Baker)",
    content: {
      logDate: "2026-08-06",
      feedBrand: "Ewos Micro Salmon 3.5",
      quantityFedKg: 1980,
      biomassEstKg: 95000,
      feedConversionRatio: 1.95, // Flagged: abnormal FCR (> 1.7, feed wastage or calculation error)
      dailyMortalityCount: 195, // Flagged: high mortality
      dailyMortalityPercent: 0.21, // Flagged: > 0.15% per day
      feedBatchNumber: "EWOS-4401-X"
    }
  },
  {
    id: "temp-wq-001",
    fileName: "water_quality_sensors_site3.csv",
    type: DOCUMENT_TYPES.WATER_QUALITY,
    facility: "Recirculating Aquaculture System (RAS) Unit 3",
    uploader: "WQ Monitor (Amara Okafor)",
    content: {
      logTime: "2026-08-07T08:00:00Z",
      pH: 7.42, // Normal
      dissolvedOxygenMgL: 7.8, // Normal
      salinityPpt: 32.5,
      waterTempC: 15.4, // Normal
      ammoniaMgL: 0.012, // Normal
      sensorStatus: "Calibrated & Active"
    }
  },
  {
    id: "temp-wq-002",
    fileName: "water_quality_breach_site1.csv",
    type: DOCUMENT_TYPES.WATER_QUALITY,
    facility: "Ocean Pen 1 (Marine Site A)",
    uploader: "Field Technician (Tim Baker)",
    content: {
      logTime: "2026-08-07T09:30:00Z",
      pH: 6.10, // Flagged: too acidic (< 6.5)
      dissolvedOxygenMgL: 4.2, // Flagged: critical DO depletion (< 5.0)
      salinityPpt: 31.0,
      waterTempC: 22.8, // Normal but warm
      ammoniaMgL: 0.085, // Flagged: toxic ammonia level (> 0.05)
      sensorStatus: "Sensor warning - Biofouling suspected"
    }
  },
  {
    id: "temp-land-001",
    fileName: "vessel_landing_nordic_star_20260805.pdf",
    type: DOCUMENT_TYPES.HARVEST_LANDING,
    facility: "Port landing Dock C (Cooperative Depot)",
    uploader: "Vessel Captain (Bjorn Lindstrom)",
    content: {
      vesselName: "Nordic Star (Registration: WX-8820)",
      landingDate: "2026-08-05",
      catchZone: "FAO Area 27 (Northeast Atlantic)",
      speciesCode: "COD (Gadus morhua)",
      weightKg: 11250, // Normal
      quotaLimitKg: 15000,
      catchCertificateId: "EU-CC-2026-98122",
      bycatchWeightKg: 340,
      discardRatePercent: 0.2
    }
  },
  {
    id: "temp-land-002",
    fileName: "vessel_landing_breach_sea_spray.pdf",
    type: DOCUMENT_TYPES.HARVEST_LANDING,
    facility: "Port landing Dock A (Cooperative Depot)",
    uploader: "Port Inspector (Sarah Jenkins)",
    content: {
      vesselName: "Sea Spray (Registration: WX-1049)",
      landingDate: "2026-08-06",
      catchZone: "FAO Area 27 (Protected Marine Sanctuary Subzone 4)", // Flagged catch zone
      speciesCode: "HER-02 (Atlantic Herring)",
      weightKg: 18200, // Flagged: over-quota landing (> 15000)
      quotaLimitKg: 14000,
      catchCertificateId: "EU-CC-2026-44021",
      bycatchWeightKg: 1980,
      discardRatePercent: 2.1
    }
  },
  {
    id: "temp-grade-001",
    fileName: "grading_cert_lot_88921.pdf",
    type: DOCUMENT_TYPES.GRADING,
    facility: "Processing Plant Line B",
    uploader: "Quality Manager (Yuki Tanaka)",
    content: {
      batchLotId: "LOT-88921-SAL",
      inspectionDate: "2026-08-06",
      gradeASharePercent: 82.5,
      gradeBSharePercent: 15.0,
      gradeCSharePercent: 2.5,
      freshnessIndexScore: 92.4, // Normal
      defectRatePercent: 1.8, // Normal (bruising or skin damage)
      chemicalResidueStatus: "Negative (Passed)",
      parasiteChecks: "None detected"
    }
  },
  {
    id: "temp-grade-002",
    fileName: "grading_cert_lot_88922_decay.pdf",
    type: DOCUMENT_TYPES.GRADING,
    facility: "Processing Plant Line A",
    uploader: "Quality Assessor (Yuki Tanaka)",
    content: {
      batchLotId: "LOT-88922-SAL",
      inspectionDate: "2026-08-06",
      gradeASharePercent: 41.0,
      gradeBSharePercent: 39.0,
      gradeCSharePercent: 20.0,
      freshnessIndexScore: 68.2, // Flagged: poor freshness (< 75%)
      defectRatePercent: 11.5, // Flagged: high defect rate (> 8%)
      chemicalResidueStatus: "Negative (Passed)",
      parasiteChecks: "Presence of sea lice scars noted"
    }
  },
  {
    id: "temp-cold-001",
    fileName: "cold_storage_log_room_C1.csv",
    type: DOCUMENT_TYPES.COLD_STORAGE,
    facility: "Central Processing Cold Storage Room C1",
    uploader: "Facility Operator (David Vance)",
    content: {
      logPeriod: "2026-08-06T00:00Z to 2026-08-06T23:59Z",
      averageTempC: -21.4, // Normal
      maxTempC: -19.2, // Normal
      minTempC: -23.1,
      powerInterruptionMinutes: 0,
      humidityPercent: 85.2,
      defrostCyclesRun: 2
    }
  },
  {
    id: "temp-cold-002",
    fileName: "cold_storage_temp_breach.csv",
    type: DOCUMENT_TYPES.COLD_STORAGE,
    facility: "Transit Cold Trailer #14",
    uploader: "Driver (David Vance)",
    content: {
      logPeriod: "2026-08-06T12:00Z to 2026-08-06T18:00Z",
      averageTempC: -14.2, // Flagged: warm average (> -18.0)
      maxTempC: -9.8, // Flagged: high temperature breach
      minTempC: -17.5,
      powerInterruptionMinutes: 45, // Flagged
      humidityPercent: 91.8,
      defrostCyclesRun: 1
    }
  },
  {
    id: "temp-proc-001",
    fileName: "processing_yield_batch_202G.pdf",
    type: DOCUMENT_TYPES.PROCESSING,
    facility: "Processing Hub - Filleting Department",
    uploader: "Line Manager (Yuki Tanaka)",
    content: {
      batchId: "PROC-202G-881",
      inputWeightKg: 10500,
      outputWeightKg: 6930, // Gutted and filleted
      yieldRecoveryPercent: 66.0, // Normal recovery for fillets (~60-70%)
      packagingType: "Vacuum Sealed Skin Packs",
      allergensLabeled: "Yes (Contains Fish)",
      sanitationLogStatus: "Sanitized & Verified (Pre-shift & Post-shift)",
      traceabilityCode: "TRA-SAL-202G-98"
    }
  },
  {
    id: "temp-proc-002",
    fileName: "processing_batch_fail_yield.pdf",
    type: DOCUMENT_TYPES.PROCESSING,
    facility: "Processing Hub - Filleting Department",
    uploader: "Line Lead (Tim Baker)",
    content: {
      batchId: "PROC-202G-882",
      inputWeightKg: 12000,
      outputWeightKg: 6240,
      yieldRecoveryPercent: 52.0, // Flagged: abnormally low yield recovery (< 55% for fillet)
      packagingType: "Bulk Ice Crates",
      allergensLabeled: "No (Missing Allergen Labeling)", // Flagged
      sanitationLogStatus: "Sanitation log incomplete for Shift 2", // Flagged
      traceabilityCode: "TRA-SAL-202G-99"
    }
  },
  {
    id: "temp-sales-001",
    fileName: "sales_invoice_INV_9088.pdf",
    type: DOCUMENT_TYPES.SALES,
    facility: "Commercial Office (Cooperative Sales)",
    uploader: "Sales Coordinator (Elena Rostova)",
    content: {
      invoiceNumber: "INV-2026-9088",
      customerName: "Global Seafood Distributors LLC",
      orderDate: "2026-08-05",
      productType: "Atlantic Salmon Premium Fillets (Fresh)",
      totalWeightKg: 5000,
      unitPriceUsd: 12.50,
      invoiceValueUsd: 62500.00,
      healthCertAttached: "Verified & Attached (AQ-HC-9811)",
      paymentTerms: "Net 30"
    }
  },
  {
    id: "temp-sales-002",
    fileName: "sales_invoice_unlicensed_customer.pdf",
    type: DOCUMENT_TYPES.SALES,
    facility: "Commercial Office (Cooperative Sales)",
    uploader: "Sales Coordinator (Elena Rostova)",
    content: {
      invoiceNumber: "INV-2026-9089",
      customerName: "Fly-by-Night Fish Wholesaler Ltd.",
      orderDate: "2026-08-06",
      productType: "Atlantic Salmon Fillets (B-Grade)",
      totalWeightKg: 8500,
      unitPriceUsd: 7.20,
      invoiceValueUsd: 61200.00,
      healthCertAttached: "Not Attached - Pending", // Flagged
      paymentTerms: "Cash on Delivery (COD)"
    }
  }
];

// Helper to run automated validation rules and output validation messages and flag triggers
function validateDocumentContent(type, content) {
  const alerts = [];
  let status = 'Auto-Approved';
  let extractionConfidence = 95.0; // Default high confidence

  switch (type) {
    case DOCUMENT_TYPES.STOCKING:
      if (content.transportMortalityPercent > 5.0) {
        alerts.push({
          field: 'transportMortalityPercent',
          severity: 'Critical',
          message: `Transport mortality rate of ${content.transportMortalityPercent}% exceeds acceptable 5% threshold.`
        });
        status = 'Flagged';
      }
      if (content.healthCertificateStatus.toLowerCase().includes('pending') || content.healthCertificateStatus.toLowerCase().includes('missing')) {
        alerts.push({
          field: 'healthCertificateStatus',
          severity: 'Critical',
          message: 'Official Health Certificate status is pending or missing. Release of stock is restricted.'
        });
        status = 'Flagged';
      }
      if (content.inspectorSignOff.toLowerCase().includes('none') || content.inspectorSignOff.toLowerCase().includes('pending')) {
        alerts.push({
          field: 'inspectorSignOff',
          severity: 'Warning',
          message: 'No official inspector sign-off on record. Requires manager verification.'
        });
        if (status !== 'Critical') status = 'Flagged';
      }
      break;

    case DOCUMENT_TYPES.FEEDING:
      if (content.feedConversionRatio > THRESHOLDS.FEEDING.FCR_MAX) {
        alerts.push({
          field: 'feedConversionRatio',
          severity: 'Warning',
          message: `Feed Conversion Ratio (FCR) of ${content.feedConversionRatio} is abnormally high. Potential overfeeding or feed wastage.`
        });
        status = 'Flagged';
      }
      if (content.feedConversionRatio < THRESHOLDS.FEEDING.FCR_MIN) {
        alerts.push({
          field: 'feedConversionRatio',
          severity: 'Warning',
          message: `FCR of ${content.feedConversionRatio} is below biological minimum (0.8). Verify biomass or feed weights.`
        });
        status = 'Flagged';
      }
      if (content.dailyMortalityPercent > THRESHOLDS.FEEDING.MORTALITY_MAX) {
        alerts.push({
          field: 'dailyMortalityPercent',
          severity: 'Critical',
          message: `Daily mortality of ${content.dailyMortalityPercent}% exceeds bio-security alert threshold (${THRESHOLDS.FEEDING.MORTALITY_MAX}%).`
        });
        status = 'Flagged';
      }
      break;

    case DOCUMENT_TYPES.WATER_QUALITY:
      if (content.pH < THRESHOLDS.WATER_QUALITY.PH_MIN || content.pH > THRESHOLDS.WATER_QUALITY.PH_MAX) {
        alerts.push({
          field: 'pH',
          severity: 'Critical',
          message: `Water pH level of ${content.pH} is out of safe range (${THRESHOLDS.WATER_QUALITY.PH_MIN} - ${THRESHOLDS.WATER_QUALITY.PH_MAX}). Acidosis/alkalosis risk.`
        });
        status = 'Flagged';
      }
      if (content.dissolvedOxygenMgL < THRESHOLDS.WATER_QUALITY.DO_MIN) {
        alerts.push({
          field: 'dissolvedOxygenMgL',
          severity: 'Critical',
          message: `Dissolved Oxygen level is critical at ${content.dissolvedOxygenMgL} mg/L (Minimum: ${THRESHOLDS.WATER_QUALITY.DO_MIN} mg/L). Suffocation risk.`
        });
        status = 'Flagged';
      }
      if (content.ammoniaMgL > THRESHOLDS.WATER_QUALITY.AMMONIA_MAX) {
        alerts.push({
          field: 'ammoniaMgL',
          severity: 'Critical',
          message: `Toxic ammonia levels detected: ${content.ammoniaMgL} mg/L (Max limit: ${THRESHOLDS.WATER_QUALITY.AMMONIA_MAX} mg/L).`
        });
        status = 'Flagged';
      }
      if (content.waterTempC > THRESHOLDS.WATER_QUALITY.TEMP_MAX || content.waterTempC < THRESHOLDS.WATER_QUALITY.TEMP_MIN) {
        alerts.push({
          field: 'waterTempC',
          severity: 'Warning',
          message: `Water temperature of ${content.waterTempC}°C is outside the optimal growth curve (${THRESHOLDS.WATER_QUALITY.TEMP_MIN}°C - ${THRESHOLDS.WATER_QUALITY.TEMP_MAX}°C).`
        });
        if (status !== 'Critical') status = 'Flagged';
      }
      if (content.sensorStatus.toLowerCase().includes('warning') || content.sensorStatus.toLowerCase().includes('fail')) {
        alerts.push({
          field: 'sensorStatus',
          severity: 'Warning',
          message: `Sensor hardware report flags warnings: "${content.sensorStatus}". Recalibration recommended.`
        });
        if (status !== 'Critical') status = 'Flagged';
      }
      break;

    case DOCUMENT_TYPES.HARVEST_LANDING:
      if (content.weightKg > THRESHOLDS.HARVEST_LANDING.QUOTA_MAX_KG) {
        alerts.push({
          field: 'weightKg',
          severity: 'Critical',
          message: `Landing weight of ${content.weightKg} kg exceeds the vessel's single-trip quota allocation of ${content.quotaLimitKg} kg.`
        });
        status = 'Flagged';
      }
      if (content.catchZone.toLowerCase().includes('protected') || content.catchZone.toLowerCase().includes('sanctuary')) {
        alerts.push({
          field: 'catchZone',
          severity: 'Critical',
          message: `Sanctuary / Protected catch zone alert! Catch reported in restricted zone: "${content.catchZone}". Regulatory breach risk.`
        });
        status = 'Flagged';
      }
      if (content.discardRatePercent > 1.5) {
        alerts.push({
          field: 'discardRatePercent',
          severity: 'Warning',
          message: `High discard/bycatch rate of ${content.discardRatePercent}%. Review net size configuration.`
        });
        if (status !== 'Critical') status = 'Flagged';
      }
      break;

    case DOCUMENT_TYPES.GRADING:
      if (content.freshnessIndexScore < THRESHOLDS.GRADING.FRESHNESS_MIN) {
        alerts.push({
          field: 'freshnessIndexScore',
          severity: 'Critical',
          message: `Lot freshness index is below acceptable processing standards (${content.freshnessIndexScore}% vs Min: ${THRESHOLDS.GRADING.FRESHNESS_MIN}%).`
        });
        status = 'Flagged';
      }
      if (content.defectRatePercent > THRESHOLDS.GRADING.DEFECT_MAX) {
        alerts.push({
          field: 'defectRatePercent',
          severity: 'Warning',
          message: `Defect rate is high (${content.defectRatePercent}% vs Limit: ${THRESHOLDS.GRADING.DEFECT_MAX}%). Grade A share reduced.`
        });
        if (status !== 'Critical') status = 'Flagged';
      }
      break;

    case DOCUMENT_TYPES.COLD_STORAGE:
      if (content.averageTempC > THRESHOLDS.COLD_STORAGE.TEMP_MAX) {
        alerts.push({
          field: 'averageTempC',
          severity: 'Critical',
          message: `Average room temperature of ${content.averageTempC}°C violates the deep-freeze requirement (${THRESHOLDS.COLD_STORAGE.TEMP_MAX}°C). Cold chain compromised.`
        });
        status = 'Flagged';
      }
      if (content.maxTempC > -12.0) {
        alerts.push({
          field: 'maxTempC',
          severity: 'Critical',
          message: `Critical temperature spike detected! Max temperature reached ${content.maxTempC}°C. Immediate inspection needed.`
        });
        status = 'Flagged';
      }
      if (content.powerInterruptionMinutes > 15) {
        alerts.push({
          field: 'powerInterruptionMinutes',
          severity: 'Critical',
          message: `Power interruption of ${content.powerInterruptionMinutes} minutes recorded. Review backup generator logs.`
        });
        status = 'Flagged';
      }
      break;

    case DOCUMENT_TYPES.PROCESSING:
      if (content.yieldRecoveryPercent < 55.0) {
        alerts.push({
          field: 'yieldRecoveryPercent',
          severity: 'Warning',
          message: `Abnormally low yield recovery of ${content.yieldRecoveryPercent}% (expected 58-68% for salmon filleting). Check machinery tuning.`
        });
        status = 'Flagged';
      }
      if (content.allergensLabeled.toLowerCase() === 'no') {
        alerts.push({
          field: 'allergensLabeled',
          severity: 'Critical',
          message: 'Allergen warning label missing from processing record. Product cannot clear commercial release.'
        });
        status = 'Flagged';
      }
      if (content.sanitationLogStatus.toLowerCase().includes('incomplete') || content.sanitationLogStatus.toLowerCase().includes('fail')) {
        alerts.push({
          field: 'sanitationLogStatus',
          severity: 'Critical',
          message: `Sanitation log verification failed: "${content.sanitationLogStatus}".`
        });
        status = 'Flagged';
      }
      break;

    case DOCUMENT_TYPES.SALES:
      if (content.healthCertAttached.toLowerCase().includes('not') || content.healthCertAttached.toLowerCase().includes('pending')) {
        alerts.push({
          field: 'healthCertAttached',
          severity: 'Critical',
          message: 'Export Health Certificate not verified. Regulatory shipping block active.'
        });
        status = 'Flagged';
      }
      break;

    default:
      break;
  }

  // Adjust extraction confidence slightly if there are issues or ambiguities
  if (status === 'Flagged') {
    extractionConfidence = parseFloat((85.0 + Math.random() * 10).toFixed(1));
  } else {
    extractionConfidence = parseFloat((95.0 + Math.random() * 4).toFixed(1));
  }

  // AI Decision Recommendation Text
  let recommendation = "";
  if (status === 'Auto-Approved') {
    recommendation = `AI recommends immediate approval. All metrics are within operational thresholds. Confidence: ${extractionConfidence}%.`;
  } else {
    const criticalAlerts = alerts.filter(a => a.severity === 'Critical');
    if (criticalAlerts.length > 0) {
      recommendation = `AI recommends HOLD / REVIEW. Critical failures: ${criticalAlerts.map(a => a.message).join('; ')}. Confidence: ${extractionConfidence}%.`;
    } else {
      recommendation = `AI recommends Review. Non-critical flags: ${alerts.map(a => a.message).join('; ')}. Confidence: ${extractionConfidence}%.`;
    }
  }

  return {
    alerts,
    status,
    extractionConfidence,
    recommendation
  };
}

// Function to process an uploaded document and generate full structured database record
function processDocument(fileInfo) {
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  
  // Extract and match against predefined templates, or fall back to a random category
  let template = MOCK_TEMPLATES.find(t => t.id === fileInfo.templateId);
  if (!template) {
    // If not matching template, generate a default one based on doc type
    const type = fileInfo.type || DOCUMENT_TYPES.WATER_QUALITY;
    template = MOCK_TEMPLATES.find(t => t.type === type) || MOCK_TEMPLATES[0];
  }

  const { alerts, status, extractionConfidence, recommendation } = validateDocumentContent(template.type, template.content);

  return {
    id,
    fileName: fileInfo.customName || template.fileName,
    type: template.type,
    facility: template.facility,
    uploader: fileInfo.uploader || template.uploader,
    uploadTime: timestamp,
    content: template.content,
    alerts,
    status,
    extractionConfidence,
    aiRecommendation: recommendation,
    decisionBy: null,
    decisionTime: null,
    reviewerNotes: null
  };
}

module.exports = {
  DOCUMENT_TYPES,
  THRESHOLDS,
  MOCK_TEMPLATES,
  processDocument,
  validateDocumentContent
};
