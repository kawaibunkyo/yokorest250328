// Cesium ionのアクセストークン
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5N2UyMjcwOS00MDY1LTQxYjEtYjZjMy00YTU0ZTg5MmViYWQiLCJpZCI6ODAzMDYsImlhdCI6MTY0Mjc0ODI2MX0.dkwAL1CcljUV7NA7fDbhXXnmyZQU_c-G5zRx8PtEcxE';

// グローバル変数
let viewer;
let shelterData = [];
let currentLocationEntity = null;
let routeEntity = null;
let nearestShelterEntity = null;
let buildingsVisible = true;
let cityModel = null;

// 初期化関数
function initialize() {
    // Cesium Viewerの初期化
    viewer = new Cesium.Viewer('cesiumContainer', {
        terrainProvider: Cesium.createWorldTerrain(),
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        vrButton: false,
        homeButton: true,
        infoBox: true,
        sceneModePicker: false,
        selectionIndicator: true,
        timeline: false,
        navigationHelpButton: false,
        scene3DOnly: true,
        skyBox: false,
        skyAtmosphere: true,
    });

    // 航空写真の追加
    viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
            url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
            maximumLevel: 19,
        })
    );

    // 3D Tilesデータの参照（PLATEAU - 建物データ）
    cityModel = viewer.scene.primitives.add(
        new Cesium.Cesium3DTileset({
            url: 'https://plateau.geospatial.jp/main/data/3d-tiles/bldg/14100_yokohama/low_resolution/tileset.json',
        })
    );

    // 初期視点を設定
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(139.6300, 35.3500, 7000.0),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-30.0),
            roll: 0.0
        }
    });

    // 避難所データの読み込み
    loadShelterData();

    // イベントリスナーの設定
    setupEventListeners();

    // 画面サイズに合わせてUIを調整
    window.addEventListener('resize', adjustUIForScreenSize);
}

// 避難所データの読み込み
async function loadShelterData() {
    try {
        const response = await fetch('./hinanjyo.geojson');
        const data = await response.json();
        shelterData = data.features;
        
        // 避難所を表示
        displayShelters(shelterData);
        
        // フィルターの初期設定
        setupFilteringUI();
    } catch (error) {
        console.error('避難所データの読み込みに失敗しました:', error);
    }
}

// 避難所を四角柱で表示
function displayShelters(shelters) {
    shelters.forEach(shelter => {
        const coords = shelter.geometry.coordinates;
        const props = shelter.properties;
        
        // レベルや種類を取得（ない場合はデフォルト値）
        const level = props.レベル || 1;
        const type = props.種類 || '指定避難所';
        
        // 高さは避難所のレベルに基づいて設定
        const height = level * 100;
        
        // 避難所の種類に基づいて色を設定
        let color;
        switch(type) {
            case '指定避難所':
                color = Cesium.Color.GREEN;
                break;
            case '広域避難場所':
                color = Cesium.Color.BLUE;
                break;
            case '一時避難場所':
                color = Cesium.Color.YELLOW;
                break;
            default:
                color = Cesium.Color.ORANGE;
        }
        
        // 避難所名を取得
        const name = props.P20_002 || '避難所';
        const address = props.P20_003 || '';
        
        // HTML説明内容
        const description = `
            <table>
                <tr>
                    <th>避難所名</th>
                    <td>${name}</td>
                </tr>
                <tr>
                    <th>住所</th>
                    <td>${address}</td>
                </tr>
                <tr>
                    <th>レベル</th>
                    <td>${level}</td>
                </tr>
                <tr>
                    <th>種類</th>
                    <td>${type}</td>
                </tr>
            </table>
        `;
        
        // プロパティを設定
        const shelterProperties = {
            isEvacuationShelter: true,
            shelterType: type,
            shelterLevel: level,
            shelterAddress: address
        };
        
        // 避難所エンティティの作成
        const entity = viewer.entities.add({
            name: name,
            description: description,
            position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], height/2),
            box: {
                dimensions: new Cesium.Cartesian3(50, 50, height),
                material: color.withAlpha(0.7),
                outline: true,
                outlineColor: Cesium.Color.BLACK
            },
            properties: shelterProperties
        });
        
        // 元の避難所データへの参照を保持
        entity.originalShelter = shelter;
    });
}

// 現在地の取得と表示
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const longitude = position.coords.longitude;
                const latitude = position.coords.latitude;
                
                // 既存の現在地マーカーがあれば削除
                if (currentLocationEntity) {
                    viewer.entities.remove(currentLocationEntity);
                }
                
                // 現在地をマーカーとして表示
                currentLocationEntity = viewer.entities.add({
                    name: '現在地',
                    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 10),
                    billboard: {
                        image: './img/current-location.png', // 現在地アイコン
                        scale: 0.5,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
                    }
                });
                
                // カメラを現在地に移動
                viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1000),
                    orientation: {
                        heading: Cesium.Math.toRadians(0),
                        pitch: Cesium.Math.toRadians(-45),
                        roll: 0
                    }
                });
                
                // 最寄りの避難所を検索してルートを表示
                findAndDisplayNearestShelter(longitude, latitude);
            },
            error => {
                console.error('位置情報の取得に失敗しました:', error);
                alert('位置情報を取得できませんでした。位置情報の使用を許可してください。');
            }
        );
    } else {
        alert('このブラウザはGeolocationをサポートしていません');
    }
}

// 最寄りの避難所を検索して表示
function findAndDisplayNearestShelter(longitude, latitude) {
    // フィルタリング条件を取得
    const selectedTypes = getSelectedShelterTypes();
    const minLevel = getMinimumShelterLevel();
    
    // フィルタリングされた避難所だけを検索対象にする
    const filteredShelters = shelterData.filter(shelter => {
        const type = shelter.properties.種類 || '指定避難所';
        const level = shelter.properties.レベル || 1;
        return selectedTypes.includes(type) && level >= minLevel;
    });
    
    if (filteredShelters.length === 0) {
        alert('フィルタ条件に合う避難所がありません。条件を変更してください。');
        return;
    }
    
    // 最寄りの避難所を検索
    const nearest = findNearestShelter(longitude, latitude, filteredShelters);
    
    if (nearest) {
        // 前回のルートがあれば削除
        if (routeEntity) {
            viewer.entities.remove(routeEntity);
        }
        
        // 前回の最寄避難所ハイライトがあれば削除
        if (nearestShelterEntity) {
            viewer.entities.remove(nearestShelterEntity);
        }
        
        // 最寄りの避難所の座標
        const shelterCoords = nearest.geometry.coordinates;
        
        // 最寄りの避難所をハイライト
        nearestShelterEntity = viewer.entities.add({
            name: '最寄り避難所',
            position: Cesium.Cartesian3.fromDegrees(shelterCoords[0], shelterCoords[1], 10),
            billboard: {
                image: './img/shelter-icon.png', // 避難所アイコン
                scale: 0.8,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM
            }
        });
        
        // 避難所詳細を表示
        updateNearestShelterInfo(nearest);
        
        // 選択された移動手段を取得
        const transportMode = getTransportMode();
        
        // ルートを表示
        showRoute([longitude, latitude], shelterCoords, transportMode);
    } else {
        alert('近くに避難所が見つかりませんでした。');
    }
}

// 最寄りの避難所を検索
function findNearestShelter(longitude, latitude, shelters) {
    let minDistance = Infinity;
    let nearestShelter = null;
    
    shelters.forEach(shelter => {
        const [shelterLng, shelterLat] = shelter.geometry.coordinates;
        const distance = calculateDistance(longitude, latitude, shelterLng, shelterLat);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestShelter = shelter;
        }
    });
    
    return nearestShelter;
}

// 緯度経度間の距離計算（ハバーサイン公式）
function calculateDistance(lon1, lat1, lon2, lat2) {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
}

// 最寄り避難所情報を更新
function updateNearestShelterInfo(shelter) {
    const props = shelter.properties;
    const name = props.P20_002 || '避難所';
    const address = props.P20_003 || '住所不明';
    const level = props.レベル || 1;
    const type = props.種類 || '指定避難所';
    
    const infoElement = document.getElementById('shelterDetails');
    infoElement.innerHTML = `
        <div class="shelter-info">
            <p class="shelter-name">${name}</p>
            <p><strong>住所:</strong> ${address}</p>
            <p><strong>種類:</strong> ${type}</p>
            <p><strong>レベル:</strong> ${level}</p>
        </div>
    `;
}

// ルートを表示
async function showRoute(start, end, transportMode = 'foot-walking') {
    // APIキー
    const apiKey = '5b3ce3597851110001cf62483d4f0c5c26f94f3291f93f9de89c0af7'; // OpenRouteService APIキー
    
    try {
        // ルート検索API URL
        const directionsUrl = `https://api.openrouteservice.org/v2/directions/${transportMode}?api_key=${apiKey}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`;
        
        // APIリクエスト
        const response = await fetch(directionsUrl);
        const data = await response.json();
        
        // ルートのジオメトリを取得
        const routeCoordinates = data.features[0].geometry.coordinates;
        
        // 地形の高さを考慮した3D座標に変換
        const positions = await getElevatedPositions(routeCoordinates);
        
        // 既存のルートを削除
        if (routeEntity) {
            viewer.entities.remove(routeEntity);
        }
        
        // ルートをポリラインで表示
        routeEntity = viewer.entities.add({
            name: '避難経路',
            polyline: {
                positions: positions,
                width: 10,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.2,
                    color: Cesium.Color.RED
                }),
                clampToGround: true
            }
        });
        
        // ルートにカメラを合わせる
        viewer.zoomTo(routeEntity);
        
    } catch (error) {
        console.error('ルート検索に失敗しました:', error);
        alert('避難経路の検索に失敗しました。');
    }
}

// 地形の高さを考慮した3D座標に変換
async function getElevatedPositions(coordinates) {
    const positions = [];
    
    // 各座標の高度を地形に基づいて取得
    for (let i = 0; i < coordinates.length; i++) {
        const [longitude, latitude] = coordinates[i];
        
        // Cesiumの地形から高さを取得
        const height = await getTerrainHeight(longitude, latitude);
        
        // 地表から2m上の高さに設定（見やすさのため）
        positions.push(Cesium.Cartesian3.fromDegrees(longitude, latitude, height + 2));
    }
    
    return positions;
}

// 地形の高さを取得
function getTerrainHeight(longitude, latitude) {
    return new Promise((resolve) => {
        const terrainProvider = viewer.terrainProvider;
        const cartographic = Cesium.Cartographic.fromDegrees(longitude, latitude);
        
        // 地形の高さをサンプリング
        const promise = Cesium.sampleTerrainMostDetailed(terrainProvider, [cartographic]);
        Promise.resolve(promise)
            .then((updatedPositions) => {
                resolve(updatedPositions[0].height);
            })
            .catch(() => {
                resolve(0); // エラー時は高さ0とする
            });
    });
}

// イベントリスナーのセットアップ
function setupEventListeners() {
    // 現在地取得ボタン
    document.getElementById('getCurrentLocationBtn').addEventListener('click', getCurrentLocation);
    
    // 表示リセットボタン
    document.getElementById('resetViewBtn').addEventListener('click', resetView);
    
    // 建物表示切替ボタン
    document.getElementById('toggleBuildingsBtn').addEventListener('click', toggleBuildingsVisibility);
    
    // レベルフィルターのスライダー
    const levelSlider = document.getElementById('levelFilter');
    if (levelSlider) {
        levelSlider.addEventListener('input', () => {
            document.getElementById('levelValue').textContent = levelSlider.value;
            updateFilters();
        });
    }
}

// フィルタリングUI初期設定
function setupFilteringUI() {
    // 避難所タイプのチェックボックス
    document.querySelectorAll('input[name="shelterType"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateFilters);
    });
    
    // 移動手段のラジオボタン
    document.querySelectorAll('input[name="transportMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            // 現在地と避難所が選択されている場合は、ルートを更新
            if (currentLocationEntity && nearestShelterEntity) {
                const currPos = currentLocationEntity.position.getValue(Cesium.JulianDate.now());
                const cart = Cesium.Cartographic.fromCartesian(currPos);
                const lon = Cesium.Math.toDegrees(cart.longitude);
                const lat = Cesium.Math.toDegrees(cart.latitude);
                
                findAndDisplayNearestShelter(lon, lat);
            }
        });
    });
}

// フィルターの更新と適用
function updateFilters() {
    const selectedTypes = getSelectedShelterTypes();
    const minLevel = getMinimumShelterLevel();
    
    // 全エンティティをフィルタリング
    viewer.entities.values.forEach(entity => {
        // 避難所エンティティだけを処理
        if (entity.properties && entity.properties.isEvacuationShelter) {
            const type = entity.properties.shelterType;
            const level = entity.properties.shelterLevel;
            
            // フィルタ条件に合致するかどうか
            const matchesType = selectedTypes.includes(type._value);
            const matchesLevel = level._value >= minLevel;
            
            // 表示/非表示を設定
            entity.show = matchesType && matchesLevel;
        }
    });
    
    // 避難所が1つも表示されない場合は警告
    const visibleShelters = viewer.entities.values.filter(entity => 
        entity.properties && 
        entity.properties.isEvacuationShelter && 
        entity.show
    );
    
    if (visibleShelters.length === 0) {
        alert('選択された条件に合う避難所がありません。条件を変更してください。');
    }
}

// 選択された避難所タイプを取得
function getSelectedShelterTypes() {
    const checkboxes = document.querySelectorAll('input[name="shelterType"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// 最小レベルを取得
function getMinimumShelterLevel() {
    const levelFilter = document.getElementById('levelFilter');
    return parseInt(levelFilter.value, 10);
}

// 選択された移動手段を取得
function getTransportMode() {
    const modeRadio = document.querySelector('input[name="transportMode"]:checked');
    return modeRadio ? modeRadio.value : 'foot-walking';
}

// 表示をリセット
function resetView() {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(139.6300, 35.3500, 7000.0),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-30.0),
            roll: 0.0
        }
    });
}

// 建物の表示/非表示を切り替え
function toggleBuildingsVisibility() {
    if (cityModel) {
        buildingsVisible = !buildingsVisible;
        cityModel.show = buildingsVisible;
        
        // ボタンテキストを更新
        const toggleBtn = document.getElementById('toggleBuildingsBtn');
        toggleBtn.textContent = buildingsVisible ? '建物表示オフ' : '建物表示オン';
    }
}

// 画面サイズに合わせてUIを調整
function adjustUIForScreenSize() {
    const isMobile = window.innerWidth < 768;
    const sideMenu = document.getElementById('sideMenu');
    const cesiumContainer = document.getElementById('cesiumContainer');
    
    if (isMobile) {
        sideMenu.style.width = '100%';
        sideMenu.style.height = '200px';
        sideMenu.style.bottom = '0';
        sideMenu.style.top = 'auto';
        
        cesiumContainer.style.width = '100%';
        cesiumContainer.style.height = 'calc(100% - 200px)';
        cesiumContainer.style.left = '0';
    } else {
        sideMenu.style.width = '300px';
        sideMenu.style.height = '100%';
        sideMenu.style.top = '0';
        sideMenu.style.bottom = 'auto';
        
        cesiumContainer.style.width = 'calc(100% - 300px)';
        cesiumContainer.style.height = '100%';
        cesiumContainer.style.left = '300px';
    }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', initialize);
