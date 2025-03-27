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

// JSONファイルを格納する変数
let allRestaurantData = [];

// JSONファイルの読み込み
fetch('yokohama_restaurant_1000_1km_2_1000.json')
    .then(response => response.json())
    .then(data => {
        allRestaurantData = data;  // データを検証して無効なデータを除外
        let clusters = createClusters(allRestaurantData);  // createClustersを呼び出す際に返り値を取得
        displayClusters(clusters);  // その返り値を使ってクラスタを表示
        displayEntities(allRestaurantData);  // 初期状態で全てのレストランデータを表示
    })
    .catch(error => {
        console.error('JSONファイルの読み込みエラー:', error);
    });


// 価格帯フィルタリングを更新する関数
function updatePriceFilter() {
    const selectedPriceRanges = getSelectedPriceRanges();  // チェックされた価格帯を取得
    const filteredData = filterDataByPrice(allRestaurantData, selectedPriceRanges);  // フィルタリングされたデータ

    // 以前のデータをクリア
    clearOldData();

    // クラスタリングと表示の更新
    const clusters = createClusters(filteredData);
    displayClusters(clusters);
    displayEntities(filteredData);
}

// チェックされた価格帯を取得する関数
function getSelectedPriceRanges() {
    let selectedPriceRanges = [];
    document.querySelectorAll('#priceFilter input[type="checkbox"]:checked').forEach((checkbox) => {
        selectedPriceRanges.push(checkbox.value);
    });
    return selectedPriceRanges;
}

// クラスタコレクションの定義
var clusterCollection = new Cesium.EntityCollection(); // クラスタを管理するエンティティコレクション

// 価格帯でフィルタリングする関数
function filterDataByPrice(data, selectedPriceRanges) {
    return data.filter((item) => {
        if (selectedPriceRanges.length === 0) return true;
        return selectedPriceRanges.includes(item.price_level);
    });
}


// カメラのズームレベルに応じた距離閾値を計算する関数
function calculateDistanceThreshold(camera) {
    const height = camera.positionCartographic.height; // カメラの高度
    const minThreshold = 100;  // 最小のクラスタ範囲（閾値）
    const maxThreshold = 5000;  // 最大のクラスタ範囲（閾値）

    // 高度に応じた距離閾値を計算（ズームイン時に範囲が小さく、ズームアウト時に範囲が広くなる）
    let threshold = maxThreshold * Math.pow(height / 10000, 1.5);

    // 計算された値が最小・最大範囲内に収まるように調整
    threshold = Math.max(minThreshold, Math.min(threshold, maxThreshold));

    return threshold;
}


// 2地点間の距離を計算する関数
function distance(point1, point2) {
    const radLat1 = Cesium.Math.toRadians(point1.lat);
    const radLat2 = Cesium.Math.toRadians(point2.lat);
    const deltaLat = radLat2 - radLat1;
    const deltaLng = Cesium.Math.toRadians(point2.lng - point1.lng);

    const a = Math.sin(deltaLat / 2) ** 2 +
              Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLng / 2) ** 2;
    return 2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // 地球半径: 6371000メートル
}

// クラスタの中心位置を更新する関数
function updateClusterCenter(cluster) {
    const latSum = cluster.points.reduce((sum, point) => sum + point.lat, 0);
    const lngSum = cluster.points.reduce((sum, point) => sum + point.lng, 0);
    cluster.center = {
        lat: latSum / cluster.points.length,
        lng: lngSum / cluster.points.length
    };
}

// クラスタを作成する関数
function createClusters(data, distanceThreshold) {
    let clusters = [];

    data.forEach((point) => {
        let addedToCluster = false;
        for (let cluster of clusters) {
            if (distance(point, cluster.center) < distanceThreshold) {
                cluster.points.push(point);
                updateClusterCenter(cluster); // クラスタの中心を更新
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

// クラスタを表示する関数
function displayClusters(clusters) {
    viewer.entities.removeAll(); // 現在のエンティティをクリア

    clusters.forEach((cluster) => {
        const priceLevels = cluster.points
            .map(point => point.price_level)
            .filter(val => val !== "N/A" && val !== null && val !== undefined);

        const ratings = cluster.points
            .map(point => point.rating)
            .filter(val => val !== "N/A" && val !== null && val !== undefined);

        const avgPriceLevel = priceLevels.length > 0
            ? priceLevels.reduce((sum, val) => sum + val, 0) / priceLevels.length
            : null;

        const avgRating = ratings.length > 0
            ? ratings.reduce((sum, val) => sum + val, 0) / ratings.length
            : null;

        // const hue = avgPriceLevel !== null
        //     ? 120 - ((Math.min(Math.max(avgPriceLevel, 1), 5) - 1) / 4) * 160
        //     : 180;
        const hue = avgRating !== null
            ? 120 + (Math.min(Math.max(avgRating, 1), 5) / 5) * 250
            : 120;

        // HSL 色の作成
        const colorHSL = Cesium.Color.fromCssColorString(`hsl(${hue}, 50%, 50%)`);

        if (cluster.points.length > 1) {
            // カメラの情報を取得
            const camera = viewer.camera;
            const height = camera.positionCartographic.height; // カメラの高度（ズームレベル）
        
            // フォントサイズの調整（ズームイン時に小さく、ズームアウト時に大きく）
            const fontSize = Math.max(10, 16 - Math.log2(height / 1000)); // 16pxから減少していく
        
            // ラベルの位置調整（ズームイン時にラベルが下に埋まらないように）
            const pixelOffsetY = Math.max(-70, -10 - Math.log2(height / 1000) * 150);// ズームイン時にもっと上に表示
        
            // ラベルを追加
            viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(cluster.center.lng, cluster.center.lat),
                label: {
                    text: cluster.points.length.toString() + "店",
                    font: `${fontSize}px sans-serif`, // 動的に変更されたフォントサイズ
                    fillColor: Cesium.Color.WHITE,
                    backgroundColor: colorHSL.withAlpha(0.7),
                    backgroundPadding: new Cesium.Cartesian2(10, 10),
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, pixelOffsetY), // 動的に変更された位置
                },
                ellipse: {
                    semiMinorAxis: 15 * cluster.points.length,
                    semiMajorAxis: 15 * cluster.points.length,
                    material: colorHSL.withAlpha(0.7),
                }
            });
        }
    });
}

// JSONファイルの読み込みと初期化
fetch('yokohama_restaurant_1000_1km_2_1000.json')
    .then(response => response.json())
    .then(data => {
        allRestaurantData = data.map(item => ({
            lat: item.geometry.location.lat,
            lng: item.geometry.location.lng,
            price_level: item.price_level === "N/A" ? null : (item.price_level || 1),
            rating: item.rating === "N/A" ? null : (item.rating || 1)
        }));

        updateClusters(); // 初期表示のクラスタリングを実行
    })
    .catch(error => {
        console.error('JSONファイルの読み込みエラー:', error);
    });

// カメラの移動終了イベントリスナーを追加
viewer.scene.camera.moveEnd.addEventListener(updateClusters);

// 個別のエンティティ（店舗）の表示
function displayEntities(data) {
    data.forEach(item => {
        const height = 200; // 高さを一定に設定

        // price_level の取得とデフォルト値の設定 (N/A や undefined の場合は null)
        const priceLevel = item.price_level === "N/A" ? null : (item.price_level || 1);
        const priceLevelNormalized = priceLevel ? Math.min(Math.max(priceLevel, 1), 5) : 1; // 1 から 5 に正規化

        // rating の取得とデフォルト値の設定 (N/A や undefined の場合は null)
        const rating = item.rating === "N/A" ? null : (item.rating || 1);
        const ratingNormalized = rating ? Math.min(Math.max(rating, 1), 5) : 1; // 1 から 5 に正規化

        // 色相 (priceLevel が低いと緑、価格が高いと紫に近づく、null の場合は水色)
        const hue = priceLevel ? 120 - ((priceLevelNormalized - 1) / 4) * 160 : 180; // 緑(120)から紫(280)に変化

        // 彩度と明度の設定 (rating が null の場合は 0%)
        const saturation = rating ? (ratingNormalized / 5) * 100 : 0; // 彩度を 0-100% の範囲に設定
        const lightness = rating ? (ratingNormalized / 5) * 50 + 25 : 0; // 明度を 25〜75% の範囲に設定

        // HSL 色の作成
        const colorHSL = `hsl(${hue}, ${saturation}%, 50%)`;


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
   

// カメラの移動終了時にクラスタリングを更新する関数
function updateClusters() {
    const distanceThreshold = calculateDistanceThreshold(viewer.camera); // 距離閾値を再計算
    const clusters = createClusters(allRestaurantData, distanceThreshold); // クラスタリング
    displayClusters(clusters); // クラスタを表示
}


