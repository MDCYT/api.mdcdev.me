const { Router } = require("express");
const router = Router();
const { join } = require("node:path");
const axios = require("axios");
const cheerio = require("cheerio");

const { Cache } = require(join(__basedir, "utils", "cache"));
const RateLimit = require(join(__basedir, "utils", "rate-limit"));
const { responseHandler } = require(join(__basedir, "utils", "utils"));

const rucCache = new Cache("sunat-ruc", 0, 60 * 60 * 24 * 1.5);

const limit = RateLimit(15, 50);

// Utility function to decode HTML entities and fix encoding
const decodeHTMLEntities = (text) => {
  if (!text) return text;

  // Primero, intenta convertir de Latin-1 a UTF-8 si es necesario
  try {
    // Si contiene caracteres corruptos de Latin-1, reconvertir
    if (/[\xC0-\xFF]/.test(text)) {
      text = Buffer.from(text, "latin1").toString("utf-8");
    }
  } catch (e) {
    // Si falla, continuar con el texto original
  }

  const entities = {
    "&aacute;": "á",
    "&eacute;": "é",
    "&iacute;": "í",
    "&oacute;": "ó",
    "&uacute;": "ú",
    "&Aacute;": "Á",
    "&Eacute;": "É",
    "&Iacute;": "Í",
    "&Oacute;": "Ó",
    "&Uacute;": "Ú",
    "&ntilde;": "ñ",
    "&Ntilde;": "Ñ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, "g"), char);
  }

  // Also handle numeric entities like &#233;
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });

  return decoded;
};

// Utility function to convert strings to camelCase
const toCamelCase = (str) => {
  return str
    .toLowerCase()
    .replace(/[_\s-]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (match) => match.toLowerCase());
};

// Mapeo de claves en español a inglés
const keyMapping = {
  "Número de RUC": "ruc_number",
  "Tipo Contribuyente": "taxpayer_type",
  "Nombre Comercial": "trade_name",
  "Fecha de Inscripción": "registration_date",
  "Fecha de Inicio de Actividades": "start_date",
  "Estado del Contribuyente": "taxpayer_status",
  "Condición del Contribuyente": "taxpayer_condition",
  "Domicilio Fiscal": "fiscal_address",
  "Sistema Emisión de Comprobante": "voucher_emission_system",
  "Actividad Comercio Exterior": "foreign_trade_activity",
  "Sistema Contabilidad": "accounting_system",
  "Actividad(es) Económica(s)": "economic_activities",
  "Comprobantes de Pago c/aut. de impresión (F. 806 u 816)":
    "authorized_vouchers",
  "Sistema de Emisión Electrónica": "electronic_emission_system",
  "Emisor electrónico desde": "electronic_issuer_since",
  "Comprobantes Electrónicos": "electronic_vouchers",
  "Afiliado al PLE desde": "ple_affiliate_since",
  Padrones: "registries",
  "Tipo de Documento": "document_type",
  "Nombre del Contribuyente": "contributor_name",
};

router.get("/:ruc", limit, async (req, res) => {
  let { ruc } = req.params;
  ruc = ruc.toLowerCase();

  // check if ruc has 11 digits
  if (!/^\d{11}$/.test(ruc)) {
    return res.status(400).json({
      status: 400,
      message: "El RUC debe tener 11 dígitos.",
    });
  }

  let data = await rucCache.get(ruc);

  if (data) {
    return responseHandler(req.headers.accept, res, data, "ruc");
  }

  const generateKey = (l) =>
    Array.from({ length: l }, () => Math.random().toString(36).slice(2))
      .join("")
      .slice(0, l);

  try {
    // Make post request to SUNAT
    const response = await axios.post(
      "https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias",
      new URLSearchParams({
        accion: "consPorRuc",
        razSoc: "",
        nroRuc: ruc,
        nrodoc: "",
        token: generateKey(50),
        contexto: "ti-it",
        modo: "1",
        rbtnTipo: "1",
        search1: ruc,
        tipdoc: "1",
        search2: "",
        search3: "",
        codigo: "",
      }).toString(),
      {
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "es-ES,en;q=0.9,es-US;q=0.8,es;q=0.7",
          "Cache-Control": "no-cache",
          "Content-Type":
            "application/x-www-form-urlencoded; charset=ISO-8859-1",
          Pragma: "no-cache",
          Referer:
            "https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        },
        responseType: "arraybuffer",
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
      }
    );

    let html = response.data;

    // Si response.data es un buffer, convertirlo a string con ISO-8859-1
    if (Buffer.isBuffer(html)) {
      html = html.toString("latin1");
    }

    // Parse the html to get the data using cheerio
    const $ = cheerio.load(html);

    // Extract all data from the list-group-item elements
    const rawData = {};
    $(".list-group-item").each((i, row) => {
      const $row = $(row);
      const headings = $row.find("h4.list-group-item-heading");
      const texts = $row.find("p.list-group-item-text");

      // Check if this row has multiple pairs (4 elements = 2 pairs)
      if (headings.length > 1 && texts.length > 1) {
        // Process each pair of heading + text
        for (let i = 0; i < Math.min(headings.length, texts.length); i++) {
          const heading = $(headings[i]).text().trim().replace(/:$/, "");
          const text = $(texts[i]).text().trim();

          if (heading && text) {
            rawData[heading] = text;
          }
        }
      } else if (headings.length > 0) {
        // Single heading found
        const heading = headings.first().text().trim().replace(/:$/, "");
        let textValue = "";

        // Try to find text in <p> tag
        if (texts.length > 0) {
          const $text = texts.first();

          // Special handling for status with withdrawal date
          if (heading === "Estado del Contribuyente") {
            const textContent = $text.html() || $text.text();

            // Check if there's a withdrawal date in the text
            const lines = textContent
              .split(/<br\s*\/?>/gi)
              .map((line) => {
                // Remove HTML tags and trim
                return line.replace(/<[^>]*>/g, "").trim();
              })
              .filter((line) => line);

            if (lines.length > 1) {
              // Extract status (first line)
              const status = lines[0].trim();

              // Build structured data for withdrawal
              const withdrawalData = {
                status: status,
              };

              // Look for "Fecha de Baja:" in the remaining lines
              const fullText = lines.slice(1).join(" ").trim();

              if (fullText.includes("Fecha de Baja:")) {
                // Extract date after "Fecha de Baja:"
                const match = fullText.match(
                  /Fecha de Baja:\s*(\d{2}\/\d{2}\/\d{4})/
                );
                if (match) {
                  withdrawalData.withdrawal_date = match[1];
                }
              }

              textValue = withdrawalData;
            } else {
              textValue = $text.text().trim();
            }
          } else {
            textValue = $text.text().trim();
          }
        }
        // If no <p> found, check if there's another <h4> as the value
        else {
          const allH4 = $row.find("h4");
          if (allH4.length > 1) {
            textValue = $(allH4[1]).text().trim();
          }
        }

        // If still no text, check for table data
        if (!textValue) {
          const table = $row.find("table.tblResultado");
          if (table.length > 0) {
            const rows = table.find("tbody tr");
            const tableData = [];
            rows.each((idx, tr) => {
              const tdText = $(tr).find("td").text().trim();
              if (tdText) {
                tableData.push(tdText);
              }
            });
            textValue = tableData.join("\n");
          }
        }

        if (heading && textValue) {
          rawData[heading] = textValue;
        }
      }
    });

    // Check if data was found
    if (Object.keys(rawData).length === 0) {
      return res.status(404).json({
        status: 404,
        message: "RUC no encontrado.",
      });
    }

    // Transform data to English keys
    data = {};

    for (const [spanishKey, value] of Object.entries(rawData)) {
      let englishKey = keyMapping[spanishKey] || toCamelCase(spanishKey);

      // Convertir snake_case a camelCase si es necesario
      if (englishKey.includes("_")) {
        englishKey = toCamelCase(englishKey);
      }

      // Parse RUC number and business name
      if (spanishKey === "Número de RUC" && typeof value === "string") {
        const parts = value.split(" - ");
        data.rucNumber = parts[0].trim();
        data.businessName = decodeHTMLEntities(
          parts.slice(1).join(" - ").trim()
        );
      }
      // Handle document type and contributor name
      else if (
        spanishKey === "Tipo de Documento" &&
        typeof value === "string"
      ) {
        // Format: "DNI 72310874 - ORTIZ FERNANDEZ, JOSE ANTONIO"
        const match = value.match(/^(.+?)\s+(\d+)\s*-\s*(.+)$/);
        if (match) {
          data.documentType = match[1].trim().toLowerCase();
          data.documentNumber = match[2].trim();
          data.contributorName = decodeHTMLEntities(match[3].trim());
        } else {
          data.documentType = decodeHTMLEntities(value);
        }
      }
      // Handle taxpayer status with withdrawal date
      else if (spanishKey === "Estado del Contribuyente") {
        if (typeof value === "object") {
          // Convert nested keys to camelCase
          data.taxpayerStatus = {
            status: decodeHTMLEntities(value.status),
            withdrawalDate: value.withdrawal_date,
          };
        } else {
          // String status (no withdrawal)
          data.taxpayerStatus = decodeHTMLEntities(value);
        }
      }
      // Parse economic activities (can be multiline)
      else if (
        spanishKey === "Actividad(es) Económica(s)" &&
        typeof value === "string"
      ) {
        const activities = [];
        const lines = value.split("\n").filter((v) => v.trim());

        for (const line of lines) {
          const match = line.match(
            /^(Principal|Secundaria)\s*-\s*(\d+)\s*-\s*(.+)$/
          );
          if (match) {
            activities.push({
              type:
                match[1].toLowerCase() === "principal"
                  ? "primary"
                  : "secondary",
              code: match[2].trim(),
              description: decodeHTMLEntities(match[3].trim()),
            });
          }
        }

        data.economicActivities = activities;
      }
      // Parse authorized vouchers (multiline or single)
      else if (
        spanishKey ===
          "Comprobantes de Pago c/aut. de impresión (F. 806 u 816)" &&
        typeof value === "string"
      ) {
        data.authorizedVouchers = value
          .split("\n")
          .map((v) => decodeHTMLEntities(v.trim()))
          .filter((v) => v);
      }
      // Parse electronic vouchers (comma separated with dates)
      else if (
        spanishKey === "Comprobantes Electrónicos" &&
        typeof value === "string"
      ) {
        const vouchers = [];
        const parts = value.split(",");

        for (const part of parts) {
          const trimmed = part.trim();
          const match = trimmed.match(/^(.+?)\s*\(desde\s*(.+?)\)$/);
          if (match) {
            vouchers.push({
              type: decodeHTMLEntities(match[1].trim()),
              since: match[2].trim(),
            });
          } else if (trimmed) {
            vouchers.push({ type: decodeHTMLEntities(trimmed) });
          }
        }

        data.electronicVouchers = vouchers;
      }
      // All other fields - use camelCase key
      else {
        data[englishKey] =
          typeof value === "string" ? decodeHTMLEntities(value) : value;
      }
    }

    await rucCache.set(ruc, data);

    return responseHandler(req.headers.accept, res, data, "ruc");
  } catch (error) {
    // Mostrame en que linea del codigo esta el error
    return res.status(500).json({
      status: 500,
      message: "Error al conectar con SUNAT, inténtelo de nuevo más tarde.",
    });
  }
});

module.exports = router;
