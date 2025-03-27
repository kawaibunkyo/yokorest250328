var map = new maplibregl.Map({

  container: 'map', // 地図を表示する

  style: 'https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json', // 地図のスタイル

  center: [139.7024, 35.6598], // 初期中心座標（渋谷）

  zoom: 16, // ズームレベル
  
});

// APIキーを設定
const apiKey = '5b3ce3597851110001cf62483d4f0c5c26f94f3291f93f9de89c0af7';  // 取得したAPIキーをここに記入

map.on('load', async () => {
  // GeoJSONデータを追加
  const geojsonData = await fetch('./hinanjyo.geojson').then(response => response.json());

  // 避難場所のアイコンを地図に追加
  const iconImage = await map.loadImage('./img/icon.png');
  map.addImage('facility_icon', iconImage.data);

  // GeoJSONデータを地図に追加
  map.addSource('facility_point', {
    type: 'geojson',
    data: geojsonData,
  });

  map.addLayer({
    id: 'facility_point',
    type: 'symbol',
    source: 'facility_point',
    layout: {
      'icon-image': 'facility_icon',
      'icon-size': 0.1,
    },
  });

  // 地物クリック時にポップアップを表示
  map.on('click', 'facility_point', (e) => {
    var coordinates = e.features[0].geometry.coordinates.slice();
    var name = e.features[0].properties.P20_002;
    var address = e.features[0].properties.P20_003;
    var level = e.features[0].properties.レベル;

    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    new maplibregl.Popup({ offset: 10, closeButton: false })
      .setLngLat(coordinates)
      .setHTML(`<b>${name}</b><br>${address}<br>レベル: ${level}`)
      .addTo(map);
  });

  // 現在地を取得し、地図に反映
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        // 現在地を地図の中心に設定
        map.setCenter([longitude, latitude]);

        // 現在地にマーカーを追加
        new maplibregl.Marker({ color: 'red' }) // 赤いマーカー
          .setLngLat([longitude, latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 10 })
              .setHTML('<b>現在地</b>')
          )
          .addTo(map);

        // 現在地から最寄の避難場所へのルート計算
        const nearestFacility = findNearestFacility(longitude, latitude, geojsonData.features);
        if (nearestFacility) {
          showRoute([longitude, latitude], nearestFacility.geometry.coordinates);
        }
      },
      (error) => {
        console.error("位置情報の取得に失敗しました: ", error);
      }
    );
  } else {
    console.error("このブラウザはGeolocationをサポートしていません");
  }
});

// 最寄の避難場所を見つける関数
function findNearestFacility(currentLng, currentLat, facilities) {
  let minDistance = Infinity;
  let nearestFacility = null;

  facilities.forEach(facility => {
    const [facilityLng, facilityLat] = facility.geometry.coordinates;
    const distance = calculateDistance(currentLng, currentLat, facilityLng, facilityLat);

    if (distance < minDistance) {
      minDistance = distance;
      nearestFacility = facility;
    }
  });

  return nearestFacility;
}

// 緯度・経度の距離を計算する関数（Haversine formula）
function calculateDistance(lon1, lat1, lon2, lat2) {
  const R = 6371; // 地球の半径 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 距離 (km)
}

// OpenRouteService APIを使ってルートを表示する関数
function showRoute(start, end) {
  const directionsUrl = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`;

  fetch(directionsUrl)
    .then((response) => response.json())
    .then((data) => {
      const route = data.features[0].geometry; // ルートデータを取得

      // ルートを地図に描画
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: route,
              properties: {},
            },
          ],
        },
      });

      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#FF0000',  // ルートの色
          'line-width': 4,          // ルートの太さ
        },
      });
    })
    .catch((error) => console.error('Error fetching directions:', error));
}
