const { Router } = require('express');
const fetch = require('node-fetch');

const router = Router();

const CAMERA_STATUS_INTERVAL_MS = 15 * 60 * 1000;

const cameras = [
  {
    id: '1',
    nombre: 'Cámara Av. Brasil con Av. Javier Prado - Magdalena del Mar',
    ubicacion: 'Av. Brasil con Av. Javier Prado',
    direccion: 'Av. Brasil, Magdalena del Mar 15086',
    latitud: -12.089892,
    longitud: -77.065907,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Magdalena del Mar',
    zona: 'Oeste',
    urlStream: 'https://live.smartechlatam.online/claro/brasilconjavierprado/index.m3u8',
  },
  {
    id: '2',
    nombre: 'Cámara Av. Javier Prado Este - Santiago de Surco',
    ubicacion: 'Av. Javier Prado Este con Av. Alfredo Benavides',
    direccion: 'Av. Alfredo Benavides 5388, Santiago de Surco 15039',
    latitud: -12.1304994,
    longitud: -76.9843728,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Santiago de Surco',
    zona: 'Sureste',
    urlStream: 'https://live.smartechlatam.online/claro/javierprado/index.m3u8',
  },
  {
    id: '3',
    nombre: 'Cámara Av. Angamos Oeste - Surquillo',
    ubicacion: 'Av. Angamos Oeste con Pasaje Capitán Romano',
    direccion: 'Cuadra 20 cruce con Pasaje Capitán Romano - Surquillo',
    latitud: -12.1140183,
    longitud: -77.0380769,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Surquillo',
    zona: 'Sureste',
    urlStream: 'https://live.smartechlatam.online/claro/angamos/index.m3u8',
  },
  {
    id: '4',
    nombre: 'Cámara Av. El Derby - Surco',
    ubicacion: 'Jockey Club del Perú',
    direccion: 'Av. El Derby, Santiago de Surco 15023',
    latitud: -12.0975048,
    longitud: -76.9783962,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Santiago de Surco',
    zona: 'Sureste',
    urlStream: 'https://live.smartechlatam.online/claro/derby/index.m3u8',
  },
  {
    id: '5',
    nombre: 'Cámara Av. Prolongación Tacna - Rimac',
    ubicacion: 'Av. Prolongación Tacna con Av. Los Incas',
    direccion: '277 Av. Prol. Tacna',
    latitud: -12.0373456,
    longitud: -77.0314024,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Rimac',
    zona: 'Norte',
    urlStream: 'https://live.smartechlatam.online/claro/prolongaciontacna/index.m3u8',
  },
  {
    id: '6',
    nombre: 'Cámara Av. José Faustino Sanchez Carrión - Jesús María',
    ubicacion: 'Av. José Faustino Sanchez Carrión con Av. Punta del Este',
    direccion: 'Av. Eduardo Avaroa & Av. Faustino Sánchez Carrión',
    latitud: -12.091163,
    longitud: -77.055937,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Jesús María',
    zona: 'Norte',
    urlStream: 'https://live.smartechlatam.online/claro/avfaustinocarrion/index.m3u8',
  },
  {
    id: '7',
    nombre: 'Cámara Av. La Marina - Pueblo Libre',
    ubicacion: 'Cuadra 7 - Pueblo Libre',
    direccion: 'Av. La Marina cdra. 7',
    latitud: -12.077946,
    longitud: -77.090305,
    estado: 'En Mantenimiento',
    tipo: 'Tráfico',
    distrito: 'Pueblo Libre',
    zona: 'Oeste',
    urlStream: 'https://live.smartechlatam.online/claro/lamarina/index.m3u8',
  },
  {
    id: '8',
    nombre: 'Cámara Av. Paseo de la República - Lince',
    ubicacion: 'No. 1786 cruce con avenida Canadá - Lince',
    direccion: 'Av. Paseo de la República 1786, Lince 15046',
    latitud: -12.0733821,
    longitud: -77.0301606,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Lince',
    zona: 'Oeste',
    urlStream: 'https://live.smartechlatam.online/claro/paseodelarepublica/index.m3u8',
  },
  {
    id: '9',
    nombre: 'Webcam Óvalo de Miraflores',
    ubicacion: 'Óvalo de Miraflores',
    direccion: 'Av. Arequipa con Av. Diagonal',
    latitud: -12.119611,
    longitud: -77.028922,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Miraflores',
    zona: 'Sur',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/lima/lima/miraflores.html'
    }
  },
  {
    id: '10',
    nombre: 'Webcam Parque Kennedy - Miraflores',
    ubicacion: 'Parque Kennedy, Miraflores',
    direccion: 'Av. Larco con Av. Diagonal',
    latitud: -12.122008,
    longitud: -77.030198,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Miraflores',
    zona: 'Sur',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/lima/lima/miraflores-kennedy-park.html'
    }
  },
  {
    id: '11',
    nombre: 'Webcam Plaza de Armas de Barranco',
    ubicacion: 'Plaza de Armas, Barranco',
    direccion: 'Av. Grau, Barranco',
    latitud: -12.1497522,
    longitud: -77.0209719,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Barranco',
    zona: 'Sur',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/lima/lima/barranco-plaza-de-armas.html'
    }
  },
  {
    id: '12',
    nombre: 'Webcam Playa Caballeros - Punta Hermosa',
    ubicacion: 'Playa Caballeros, Punta Hermosa',
    direccion: 'A.h la Planicie, Punta Hermosa 15846',
    latitud: -12.328981,
    longitud: -76.831048,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Punta Hermosa',
    zona: 'Sur',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/lima/lima/playa-senoritas-punta-hermosa.html'
    }
  },
  {
    id: '13',
    nombre: 'Webcam Playa Señoritas - Punta Hermosa',
    ubicacion: 'Playa Señoritas, Punta Hermosa',
    direccion: 'Mal. Superior',
    latitud: -12.324683,
    longitud: -76.834496,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Punta Hermosa',
    zona: 'Sur',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8?a=9ls3tcgugqoa1nvofo19441h24',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/lima/lima/punta-hermosa.html'
    }
  },
  {
    id: '14',
    nombre: 'Webcam Playa La Herradura - Chorrillos',
    ubicacion: 'Playa La Herradura, Chorrillos',
    direccion: 'Salida a Chorrillos, Lima 15064',
    latitud: -12.174848,
    longitud: -77.033083,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Chorrillos',
    zona: 'Sur',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/lima/lima/chorrillos-playa-la-herradura.html'
    }
  },
  {
    id: '15',
    nombre: 'Webcam San Bartolo',
    ubicacion: 'San Bartolo Beach',
    direccion: 'Playa Peñascal, San Bartolo',
    latitud: -12.3869,
    longitud: -76.7831,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'San Bartolo',
    zona: 'Sur',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/lima/lima/san-bartolo.html'
    }
  },
  {
    id: '16',
    nombre: 'Webcam Playa el Silencio - Punta Hermosa',
    ubicacion: 'Playa el Silencio, Punta Hermosa',
    direccion: 'Punta Hermosa',
    latitud: -12.324401,
    longitud: -76.836256,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Punta Hermosa',
    zona: 'Sur',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/lima/lima/playa-el-silencio.html'
    }
  },
  {
    id: '17',
    nombre: 'Webcam Plaza Mayor de Cusco - Cusco',
    ubicacion: 'Plaza Mayor, Cusco',
    direccion: 'Plaza de Armas, Cusco',
    latitud: -13.517515,
    longitud: -71.978644,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Cusco',
    zona: 'Centro',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/cusco/cusco/plaza-mayor.html'
    }
  },
  {
    id: '18',
    nombre: 'Webcam Aeropuerto Internacional Alejandro Velasco Astete - Cusco',
    ubicacion: 'Aeropuerto Alejandro Velasco Astete, Cusco',
    direccion: 'Aeropuerto Internacional Alejandro Velasco Astete',
    latitud: -13.536571,
    longitud: -71.942685,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Cusco',
    zona: 'Aeropuerto',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/cusco/cusco/aeropuerto-internacional-alejandro-velasco-astete.html'
    }
  },
  {
    id: '19',
    nombre: 'Cámara Av. Del Ejército - Magdalena del Mar',
    ubicacion: 'Av. Del Ejército con Av. Salaverry',
    direccion: 'Av. del Ejército & Av. Gral. Felipe Salaverry',
    latitud: -12.1028561,
    longitud: -77.0586142,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Magdalena del Mar',
    zona: 'Norte',
    urlStream: 'https://live.smartechlatam.online/claro/ejercitoconsalaverry/index.m3u8',
  },
  {
    id: '20',
    nombre: 'Cámara Av. República de Panamá - Surquillo',
    ubicacion: 'Av. República de Panamá Cuadra 39 - Surquillo',
    direccion: 'Av. República de Panamá & Pasaje Viquña',
    latitud: -12.1030423,
    longitud: -77.0186697,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Surquillo',
    zona: 'Norte',
    urlStream: 'https://live.smartechlatam.online/claro/republicapanama/index.m3u8',
  },
  {
    id: '21',
    nombre: 'Cámara Av. Del Ejército - Miraflores',
    ubicacion: 'Av. Del Ejército Cuadra 12 - Miraflores',
    direccion: 'Av. del Ejército 1289, Lima 15074',
    latitud: -12.110546,
    longitud: -77.051235,
    estado: 'Operativo',
    tipo: 'Tráfico',
    distrito: 'Miraflores',
    zona: 'Norte',
    urlStream: 'https://live.smartechlatam.online/claro/ejercito/index.m3u8',
  },
  {
    id: '22',
    nombre: 'Cámara Panamericana Sur - Surco',
    ubicacion: 'Panamericana Sur, Puente Atocongo',
    direccion: 'PE-1S, Santiago de Surco 15056',
    latitud: -12.1496994,
    longitud: -76.9833324,
    estado: 'En Mantenimiento',
    tipo: 'Tráfico',
    distrito: 'Santiago de Surco',
    zona: 'Norte',
    urlStream: 'https://live.smartechlatam.online/claro/panamericana/index.m3u8',
  },
  {
    id: '23',
    nombre: 'Webcam Plaza Mayor de Chachapoyas - Amazonas',
    ubicacion: 'Plaza Mayor, Chachapoyas',
    direccion: 'Plaza de Armas, Chachapoyas',
    latitud: -6.229823,
    longitud: -77.871891,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Chachapoyas',
    zona: 'Centro',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/amazonas/chachapoyas/plaza-mayor.html'
    },
  },
  {
    id: '24',
    nombre: 'Webcam Cochibamba - Amazonas',
    ubicacion: 'Cochibamba, Amazonas',
    direccion: 'Cochibamba, Amazonas',
    latitud: -6.058081,
    longitud: -77.894238,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Cochibamba',
    zona: 'Centro',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/amazonas/bongara/cocachimba.html'
    },
  },
  {
    id: '25',
    nombre: 'Webcam Casayohana - Apurimac',
    ubicacion: 'Casayohana, Apurimac',
    direccion: 'Casayohana, Apurimac',
    latitud: -13.653931,
    longitud: -73.42353,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Talavera',
    zona: 'Centro',
    urlStream: 'https://webcam.casayohana.org/memfs/2b4fa21f-109a-427c-b4ad-205a7f16c879.m3u8',
  },
  {
    id: '26',
    nombre: 'Webcam Plaza Mayor de Arequipa - Arequipa',
    ubicacion: 'Plaza Mayor, Arequipa',
    direccion: 'Portal de Flores 112, Arequipa 04001',
    latitud: -16.398854,
    longitud: -71.536175,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Arequipa',
    zona: 'Centro',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/arequipa/arequipa/plaza-mayor.html'
    },
  },
  {
    id: '27',
    nombre: 'Webcam Laguna San Nicolás - Cajamarca',
    ubicacion: 'Laguna San Nicolás, Cajamarca',
    direccion: 'CA-1465, Namora 06370',
    latitud: -7.235659,
    longitud: -78.349348,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Namora',
    zona: 'Centro',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/cajamarca/cajamarca/laguna-san-nicolas.html'
    },
  },
  {
    id: '28',
    nombre: 'Webcam Playa Huanchaco - La Libertad',
    ubicacion: 'Playa Huanchaco, Trujillo',
    direccion: 'Avenida Victor Larco Herrera 502, Huanchaco 13000',
    latitud: -8.0778875,
    longitud: -79.1200179,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Huanchaco',
    zona: 'Centro',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/department-of-la-libertad/trujillo/trujillo-huanchaco.html'
    },
  },
  {
    id: '29',
    nombre: 'Webcam Plaza de Armas de Oxapampa - Pasco',
    ubicacion: 'Plaza de Armas, Oxapampa',
    direccion: 'Av. San Martin N°451, Oxapampa 19231',
    latitud: -10.573169,
    longitud: -75.404586,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Oxapampa',
    zona: 'Centro',
    urlStream: 'https://hd-auth.skylinewebcams.com/live.m3u8',
    specialCamera: {
      provider: 'SkylineWebcams',
      url: 'https://www.skylinewebcams.com/en/webcam/peru/pasco/oxapampa/plaza-de-armas.html'
    },
  },
  {
    id: '30',
    nombre: 'Webcam Cordillera Blanca - Ancash',
    ubicacion: 'Cordillera Blanca, Huaraz',
    direccion: 'Huaraz, Ancash',
    latitud: -9.5279453,
    longitud: -77.5328862,
    estado: 'Operativo',
    tipo: 'Vigilancia',
    distrito: 'Huaraz',
    zona: 'Centro',
    urlStream: 'https://storm.webcamvibe.com/hls/stream.m3u8'
  }
];

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function getProxyUrl(req, id) {
  const baseUrl = getBaseUrl(req);
  return `${baseUrl}/v2/peru/cameras/${id}.m3u8`;
}



async function isStreamActive(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MDCDEV-camera-check/1.0',
      },
      timeout: 15000,
      size: 1024 * 128,
    });

    if (!res.ok) return false;

    const body = await res.text();
    return body.includes('#EXTM3U');
  } catch (error) {
    return false;
  }
}

async function updateCameraStatuses() {
  for (const camera of cameras) {
    // No verificar cámaras de SkylineWebcams
    if (camera.specialCamera?.provider === 'SkylineWebcams') {
      camera.estado = 'Operativo';
      continue;
    }
    
    const active = await isStreamActive(camera.urlStream);
    camera.estado = active ? 'Operativo' : 'En Mantenimiento';
  }
}

function startCameraStatusUpdater() {
  updateCameraStatuses().catch(() => {});
  setInterval(() => {
    updateCameraStatuses().catch(() => {});
  }, CAMERA_STATUS_INTERVAL_MS);
}

if (!global.camerasStatusStarted) {
  startCameraStatusUpdater();
  global.camerasStatusStarted = true;
}

router.get('/', (req, res) => {
  const baseUrl = getBaseUrl(req);
  const payload = cameras.map((camera) => ({
    ...camera,
    proxyStream: getProxyUrl(req, camera.id),
    urlStream: undefined,
  }));

  res.json({
    success: true,
    count: payload.length,
    baseUrl,
    data: payload,
    timestamp: new Date().toISOString(),
  });
});

router.get('/:id.m3u8', (req, res) => {
  const camera = cameras.find((item) => item.id === req.params.id);
  if (!camera) {
    return res.status(404).json({
      success: false,
      error: 'Camara no encontrada',
    });
  }

  res.redirect(camera.urlStream);
});

module.exports = router;
