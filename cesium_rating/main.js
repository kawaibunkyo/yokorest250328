// Cesium ionのアクセストークン
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5N2UyMjcwOS00MDY1LTQxYjEtYjZjMy00YTU0ZTg5MmViYWQiLCJpZCI6ODAzMDYsImlhdCI6MTY0Mjc0ODI2MX0.dkwAL1CcljUV7NA7fDbhXXnmyZQU_c-G5zRx8PtEcxE';

// Cesium ViewerをcesiumContainerというIDのHTML要素に初期化
var viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: new Cesium.CesiumTerrainProvider({
        url: Cesium.IonResource.fromAssetId(770371),
    }),
});

// PLATEAU-Orthoの参照
var imageProvider = new Cesium.UrlTemplateImageryProvider({
    url: 'https://gic-plateau.s3.ap-northeast-1.amazonaws.com/2020/ortho/tiles/{z}/{x}/{y}.png',
    maximumLevel: 19,
});
viewer.scene.imageryLayers.addImageryProvider(imageProvider);

// 3D Tilesデータの参照
var your_3d_tiles = viewer.scene.primitives.add(
    new Cesium.Cesium3DTileset({
        url: 'https://plateau.geospatial.jp/main/data/3d-tiles/bldg/14100_yokohama/low_resolution/tileset.json',
    })
);

// 横浜市の初期カメラ位置設定
viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(139.6300, 35.3500, 7000.0),  // 初期位置
    orientation: {
        heading: Cesium.Math.toRadians(0.0),    // 進行方向（0度は北向き）
        pitch: Cesium.Math.toRadians(-30.0),    // 地面に対する俯角（-30度で斜め下）
        roll: 0.0                               // ロール（回転）
    }
});

// すべてのレストランデータ
let allRestaurantData = [];

// JSONファイルの読み込み
fetch('yokohama_restaurant_1000_1km_2_1000.json')
    .then(response => response.json())
    .then(data => {
        allRestaurantData = data;
        let clusters = createClusters(allRestaurantData);
        displayClusters(clusters);
        displayEntities(allRestaurantData);

        // 検索ボックスのセットアップ
        setupSearchFunctionality();
    })
    .catch(error => {
        console.error('JSONファイルの読み込みエラー:', error);
    });

// 検索機能のセットアップ
function setupSearchFunctionality() {
    const searchBox = document.getElementById('searchBox');
    const searchButton = document.getElementById('searchButton');

    searchButton.addEventListener('click', () => {
        const query = searchBox.value.trim().toLowerCase();
        const results = searchInNameAndText(query);
        displaySearchResults(results);
    });
}

// 名前とレビューを検索
function searchInNameAndText(query) {
    if (!query) return [];

    return allRestaurantData.filter(restaurant => {
        const nameMatches = restaurant.name && restaurant.name.toLowerCase().includes(query);
        const reviewsMatch = restaurant.reviews && restaurant.reviews.some(review => 
            review.text && review.text.toLowerCase().includes(query)
        );
        return nameMatches || reviewsMatch;
    });
}

// 検索結果を表示
function displaySearchResults(results) {
    const container = document.getElementById('searchResults');
    container.innerHTML = ''; // 既存のデータをクリア

    if (results.length === 0) {
        container.innerHTML = '<p>検索結果が見つかりませんでした。</p>';
        return;
    }

    // 検索結果を表示
    results.forEach(restaurant => {
        const card = document.createElement('div');
        card.className = 'search-result-card';
        card.innerHTML = `
            <p>${restaurant.name}</p>
        `;
        container.appendChild(card);
    });

    // 以前のデータをクリア
    clearOldData();

    // 検索結果を allRestaurantData に反映して更新
    const searchdata = results;

    // クラスターやエンティティを再生成・再表示
    const clusters = createClusters(searchdata);
    displayClusters(clusters);
    displayEntities(searchdata);
}

clearButton.addEventListener('click', () => {
    // 以前のデータをクリア
    clearOldData();
    container.innerHTML = ''; // 既存のデータをクリア

    // 検索結果を allRestaurantData に反映して更新
    const resetdata = allRestaurantData;

    // クラスターやエンティティを再生成・再表示
    const clusters = createClusters(resetdata);
    displayClusters(clusters);
    displayEntities(resetdata);
});

// 価格帯フィルターチェックボックス
document.querySelectorAll('#priceFilter input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', updateFilter);  // チェックボックスの変更時にフィルタリングを実行
});

// クラスタコレクションの定義
var clusterCollection = new Cesium.EntityCollection(); // クラスタを管理するエンティティコレクション

// 価格帯フィルタリングを更新する関数
function updateFilter() {
    const selectedPriceRanges = getSelectedPriceRanges();  // チェックされた価格帯を取得
    const filteredData = filterDataByPrice(allRestaurantData, selectedPriceRanges);  // フィルタリングされたデータ

    // 以前のデータをクリア
    clearOldData();

    // クラスタリングと表示の更新
    const clusters = createClusters(filteredData);
    displayClusters(clusters);
    displayEntities(filteredData);
}

// 以前表示したデータをクリアする関数
function clearOldData() {
    viewer.entities.removeAll();  // すべてのエンティティを削除
    clusterCollection.removeAll(); // クラスタコレクションをクリア
}

// チェックされた価格帯を取得する関数
function getSelectedPriceRanges() {
    let selectedPriceRanges = [];
    // #priceFilter内のチェックされたチェックボックスを取得
    document.querySelectorAll('#ratingFilter input[type="checkbox"]:checked').forEach((checkbox) => {
        selectedPriceRanges.push(parseInt(checkbox.value, 10));  // 数値に変換して格納
    });
    return selectedPriceRanges;
}

// 価格帯でフィルタリングする関数
function filterDataByPrice(data, selectedPriceRanges) {
    return data.filter((item) => {
        if (selectedPriceRanges.length === 0) return true; // 価格帯が選ばれていない場合はすべて返す
        return selectedPriceRanges.includes(parseInt(item.rating, 10)); // 数値として比較
    });
}

// クラスタリング関数
function createClusters(data) {
    const distanceThreshold = calculateDistanceThreshold(viewer.camera); // カメラのズームレベルに応じた距離閾値
    let clusters = [];

    // 各ポイントを処理
    data.forEach((point) => {
        let addedToCluster = false;
        for (let cluster of clusters) {
            if (distance(point, cluster.center) < distanceThreshold) {
                cluster.points.push(point);
                updateClusterCenter(cluster); // クラスタの中心を再計算
                addedToCluster = true;
                break;
            }
        }
        if (!addedToCluster) {
            clusters.push({ center: point, points: [point] });
        }
    });
    return clusters;
}

// クラスタ間の距離を計算
function distance(point1, point2) {
    const radLat1 = Cesium.Math.toRadians(point1.lat);
    const radLat2 = Cesium.Math.toRadians(point2.lat);
    const deltaLat = radLat2 - radLat1;
    const deltaLng = Cesium.Math.toRadians(point2.lng - point1.lng);

    const a = Math.sin(deltaLat / 2) ** 2 +
              Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLng / 2) ** 2;
    return 2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // 地球半径: 6371000メートル
}

// クラスタの中心位置を更新
function updateClusterCenter(cluster) {
    const latSum = cluster.points.reduce((sum, point) => sum + point.lat, 0);
    const lngSum = cluster.points.reduce((sum, point) => sum + point.lng, 0);
    cluster.center = {
        lat: latSum / cluster.points.length,
        lng: lngSum / cluster.points.length
    };
}

// ズームレベルに応じた距離閾値の計算
function calculateDistanceThreshold(camera) {
    const zoomLevel = Math.log2(6371000 / camera.positionCartographic.height);
    return Math.max(500, 7000 / zoomLevel); // 基準値を調整して、クラスタ範囲を広げる
}

// クラスターマーカーの表示
function displayClusters(clusters) {
    clusters.forEach((cluster) => {
        // クラスタ内のデータ抽出とデフォルト値設定（N/Aは除外）
        const priceLevels = cluster.points
            .map(point => point.price_level)
            .filter(val => val !== "N/A" && val !== null && val !== undefined && val !== NaN); // N/A, null, undefined を除外

        const ratings = cluster.points
            .map(point => point.rating)
            .filter(val => val !== "N/A" && val !== null && val !== undefined && val !== NaN); // N/A, null, undefined を除外

        // 平均値の計算
        const avgPriceLevel = priceLevels.length > 0
            ? priceLevels.reduce((sum, val) => sum + val, 0) / priceLevels.length
            : null;

        const avgRating = ratings.length > 0
            ? ratings.reduce((sum, val) => sum + val, 0) / ratings.length
            : null;

        // 色の計算
        const hue = avgPriceLevel !== null
            ? 120 - ((Math.min(Math.max(avgPriceLevel, 1), 5) - 1) / 4) * 160
            : 180; // 緑(120)から紫(280)、nullの場合は青(180)
        const saturation = avgRating !== null
            ? (Math.min(Math.max(avgRating, 1), 5) / 5) * 100
            : 50; // 評価がnullの場合、彩度50%（中間値）

        const colorHSL = Cesium.Color.fromCssColorString(`hsl(${hue}, ${saturation}%, 50%)`);

        // エンティティの追加
        if (cluster.points.length > 1) {
            viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(cluster.center.lng, cluster.center.lat),
                label: {
                    text: cluster.points.length.toString(),
                    font: '20px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    backgroundColor: colorHSL.withAlpha(0.7),
                    backgroundPadding: new Cesium.Cartesian2(10, 10),
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,  // 基準位置を下端に設定
                    pixelOffset: new Cesium.Cartesian2(0, -20),  // 文字を少し上に移動（50px）
                },
                ellipse: {
                    semiMinorAxis: 500,
                    semiMajorAxis: 500,
                    material: colorHSL.withAlpha(0.7)
                }
            });
        }
    });
}

// 個別のエンティティ（店舗）の表示
function displayEntities(data) {
    data.forEach(item => {
        const height = 200; // 高さを一定に設定

        // rating の取得とデフォルト値の設定 (N/A や undefined の場合は null)
        const rating = item.rating === "N/A" ? null : (item.rating || 1);
        const ratingNormalized = rating ? Math.min(Math.max(rating, 1), 5) : 1; // 1 から 5 に正規化

        // 色相 (rating が低いと水色、評価が高いと赤紫に近づく、null の場合は灰色)
        const hue = rating === null ? 0 : 120 + ((ratingNormalized - 1) / 5) * 250; // null の場合は灰色に相当する 0
        const saturation = rating === null ? 0 : 80; // null の場合は彩度 0
        const lightness = rating === null ? 50 : 50; // 明度は固定

        // HSL 色の作成
        const colorHSL = `hsl(${hue}, ${saturation}%, ${lightness}%)`;


        const description = `
            <table>
                <tr>
                    <th>Name</th>
                    <td>${item.name}</td>
                </tr>
                <tr>
                    <th>Location</th>
                    <td>${item.geometry.location.lat}, ${item.geometry.location.lng}</td>
                </tr>
                <tr>
                    <th>Types</th>
                    <td>${item.types.join(', ')}</td>
                </tr>
                <tr>
                    <th>Address</th>
                    <td>${item.formatted_address}</td>
                </tr>
                <tr>
                    <th>Phone Number</th>
                    <td>${item.formatted_phone_number}</td>
                </tr>
                <tr>
                    <th>Website</th>
                    <td><a href="${item.website}" target="_blank">${item.website}</a></td>
                </tr>
                <tr>
                    <th>Price Level</th>
                    <td>${item.price_level}</td>
                </tr>
                <tr>
                    <th>Rating</th>
                    <td>${item.rating}</td>
                </tr>
                <tr>
                    <th>User Ratings Total</th>
                    <td>${item.user_ratings_total}</td>
                </tr>
            </table>
        `;

        // エンティティとして3D四角柱を追加 (色は HSL で指定)
        viewer.entities.add({
            name: item.name,
            description: description,
            position: Cesium.Cartesian3.fromDegrees(item.geometry.location.lng, item.geometry.location.lat, height / 2),
            box: {
                dimensions: new Cesium.Cartesian3(20, 20, height), // 幅・奥行き・高さ
                material: new Cesium.Color.fromCssColorString(colorHSL), // HSL カラーを適用
                outline: true,
                outlineColor: Cesium.Color.BLACK
            }
        });
    });
}
