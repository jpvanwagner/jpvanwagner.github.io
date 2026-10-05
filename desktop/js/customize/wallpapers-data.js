/**
 * WALLPAPERS-DATA.JS - The list of wallpapers in the Wallpaper Gallery.
 * Local images live in images/wallpapers/. Add one by uploading the image and adding a line.
 * `name` is what visitors see; the gallery sorts alphabetically.
 * `credit` = where the image comes from; shown as the thumbnail's tooltip and listed in credits.txt.
 * `thumb` (optional) = a small copy for the gallery grid, so big photos don't load until picked.
 * Joseph's own photos are added at the bottom from config/photos.js (window.SitePhotos).
 */
const wallpaperGallery = [
    { id: 'clouds', name: 'Clouds', src: 'images/wallpapers/clouds.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'nevergonna01', name: 'Never Gonna', src: 'images/wallpapers/nevergonna01.jpg', credit: 'The set of Rick Astley\'s "Never Gonna Give You Up" music video (1987). You\'ve been rickrolled.' },
    { id: 'setup', name: 'Setup', src: 'images/wallpapers/setup.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'sunburst01', name: 'Sunburst', src: 'images/wallpapers/sunburst01.png', credit: 'Source unknown (from the original site collection)' },
    { id: 'tiled-arches', name: 'Tiled: Arches', src: 'images/wallpapers/tiled-arches.png', credit: 'Microsoft Windows 3.1 (1992)' },
    { id: 'tiled-argyle', name: 'Tiled: Argyle', src: 'images/wallpapers/tiled-argyle.png', credit: 'Microsoft Windows 3.1 (1992)' },
    { id: 'tiled-black-thatch', name: 'Tiled: Black Thatch', src: 'images/wallpapers/tiled-black-thatch.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-blue-marble', name: 'Tiled: Blue Marble', src: 'images/wallpapers/tiled-blue-marble.png', credit: 'Microsoft Windows 3.1 (1992)' },
    { id: 'tiled-blue-triangles', name: 'Tiled: Blue Triangles', src: 'images/wallpapers/tiled-blue-triangles.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-blue-waves', name: 'Tiled: Blue Waves', src: 'images/wallpapers/tiled-blue-waves.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-bubbles', name: 'Tiled: Bubbles', src: 'images/wallpapers/tiled-bubbles.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-castle', name: 'Tiled: Castle', src: 'images/wallpapers/tiled-castle.png', credit: 'Microsoft Windows 3.1 (1992)' },
    { id: 'tiled-coffee-bean', name: 'Tiled: Coffee Bean', src: 'images/wallpapers/tiled-coffee-bean.png', credit: 'Microsoft Windows NT 4.0 (1996)' },
    { id: 'tiled-egypt', name: 'Tiled: Egypt', src: 'images/wallpapers/tiled-egypt.png', credit: 'Microsoft Windows 3.1 (1992)' },
    { id: 'tiled-furry-dog', name: 'Tiled: Furry Dog', src: 'images/wallpapers/tiled-furry-dog.png', credit: 'Microsoft Windows 98 (1998)' },
    { id: 'tiled-gold-weave', name: 'Tiled: Gold Weave', src: 'images/wallpapers/tiled-gold-weave.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-gone-fishing', name: 'Tiled: Gone Fishing', src: 'images/wallpapers/tiled-gone-fishing.png', credit: 'Microsoft Windows 98 (1998)' },
    { id: 'tiled-greenstone', name: 'Tiled: Greenstone', src: 'images/wallpapers/tiled-greenstone.png', credit: 'Microsoft Windows 98 (1998)' },
    { id: 'tiled-hiking-boot', name: 'Tiled: Hiking Boot', src: 'images/wallpapers/tiled-hiking-boot.png', credit: 'Microsoft Windows 98 (1998)' },
    { id: 'tiled-honey', name: 'Tiled: Honey', src: 'images/wallpapers/tiled-honey.png', credit: 'Microsoft Windows 3.1 (1992)' },
    { id: 'tiled-houndstooth', name: 'Tiled: Houndstooth', src: 'images/wallpapers/tiled-houndstooth.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-leaves', name: 'Tiled: Leaves', src: 'images/wallpapers/tiled-leaves.png', credit: 'Microsoft Windows 3.1 (1992)' },
    { id: 'tiled-metal-links', name: 'Tiled: Metal Links', src: 'images/wallpapers/tiled-metal-links.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-red-blocks', name: 'Tiled: Red Blocks', src: 'images/wallpapers/tiled-red-blocks.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-redbrick', name: 'Tiled: Redbrick', src: 'images/wallpapers/tiled-redbrick.png', credit: 'Microsoft Windows 3.1 (1992)' },
    { id: 'tiled-sandstone', name: 'Tiled: Sandstone', src: 'images/wallpapers/tiled-sandstone.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-seaside', name: 'Tiled: Seaside', src: 'images/wallpapers/tiled-seaside.png', credit: 'Microsoft Windows 98 (1998)' },
    { id: 'tiled-stitches', name: 'Tiled: Stitches', src: 'images/wallpapers/tiled-stitches.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-straw-mat', name: 'Tiled: Straw Mat', src: 'images/wallpapers/tiled-straw-mat.png', credit: 'Microsoft Windows 95 (1995)' },
    { id: 'tiled-tartan', name: 'Tiled: Tartan', src: 'images/wallpapers/tiled-tartan.png', credit: 'Microsoft Windows 3.1 (1992)' },
    { id: 'tiled-zapotec', name: 'Tiled: Zapotec', src: 'images/wallpapers/tiled-zapotec.png', credit: 'Microsoft Windows 98 (1998)' },
    { id: 'tiled-zigzag', name: 'Tiled: Zigzag', src: 'images/wallpapers/tiled-zigzag.png', credit: 'Microsoft Windows 3.1 (1992)' },
    

    { id: 'wp-none', name: '(None)', src: '', credit: 'Source unknown (from the original site collection)' }
];

// Joseph's own photographs (config/photos.js) as wallpapers
(window.SitePhotos || []).filter(p => p.wallpaper).forEach(p => wallpaperGallery.push({
    id: 'photo-' + p.id, name: 'Photo: ' + p.title, src: p.src, thumb: p.thumb,
    credit: 'Photo by Joseph VanWagner' + (p.place && !/^Location to confirm/.test(p.place) ? ', ' + p.place.replace(/ \(to confirm\)$/, '') : '') + (p.date ? ', ' + p.date : '')
}));

