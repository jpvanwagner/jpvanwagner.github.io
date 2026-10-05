/**
 * PHOTOS.JS - Joseph's own photographs (global: SitePhotos). One list that other features read:
 *   - the Wallpaper Gallery (desktop/js/customize/wallpapers-data.js) offers every photo with
 *     wallpaper: true as a desktop background, named "Photo: <title>"
 *   - a future Photos viewer can list the same entries (title, place, date, caption)
 *
 * Adding a photo:
 *   1. Save it as images/photos/<id>.jpg (about 1920px wide) and a small copy as
 *      images/photos/thumbs/<id>.jpg (about 320px wide). Strip location data before uploading.
 *   2. Add a line below.
 *
 * Fields: id, title, place, date ('' = unknown; any text like '2016' or 'Summer 2015'),
 *         caption (a sentence or two), wallpaper (true/false).
 * Places marked "(to confirm)" were guessed from the pictures; the uploaded copies had no
 * location or date information left in them.
 */
window.SitePhotos = [
    { id: 'grand-canyon',    title: 'Grand Canyon',    place: 'Grand Canyon National Park, Arizona (to confirm)', date: '',
      caption: 'Red rock layers and a pine-topped butte under a clear blue sky.', wallpaper: true },
    { id: 'alaska-range',    title: 'Alaska Range',    place: 'Interior Alaska (to confirm)', date: '',
      caption: 'Fresh snow on the peaks above a braided glacial river and spruce forest.', wallpaper: true },
    { id: 'arctic-swings',   title: 'Arctic Swings',   place: 'Alaska’s North Slope (to confirm)', date: '',
      caption: 'A playground swing set against a big tundra sky.', wallpaper: true },
    { id: 'rusted-suburban', title: 'Rusted Suburban', place: 'Arctic coast, Alaska (to confirm)', date: '',
      caption: 'A rust-eaten truck resting on the gravel near the sea.', wallpaper: true },
    { id: 'arctic-evening',  title: 'Arctic Evening',  place: 'Arctic coast, Alaska (to confirm)', date: '',
      caption: 'Still water mirroring the clouds and the lights of town along the shore.', wallpaper: true },
    { id: 'winter-over-anchorage', title: 'Winter Over Anchorage', place: 'Chugach foothills above Anchorage, Alaska (to confirm)', date: '',
      caption: 'Snowy spruce slopes looking over the city and Cook Inlet toward the distant Alaska Range.', wallpaper: true },
    { id: 'tundra-valley',   title: 'Tundra Valley',   place: 'Interior Alaska (to confirm)', date: '',
      caption: 'Green tundra hills and a winding creek below a rocky ridge.', wallpaper: true },
    { id: 'scree-slope',     title: 'Scree Slope',     place: 'Interior Alaska (to confirm)', date: '',
      caption: 'A jumble of dark, broken rock climbing toward a pale sky.', wallpaper: true },
    { id: 'passing-rain',    title: 'Passing Rain',    place: 'Interior Alaska (to confirm)', date: '',
      caption: 'A rain shower sweeping across green mountains.', wallpaper: true },
    { id: 'village-snowfall', title: 'Village Snowfall', place: 'Arctic coast, Alaska (to confirm)', date: '',
      caption: 'Houses, power lines, and deep drifts in falling snow by the frozen sea.', wallpaper: true },
    { id: 'tundra-sunset',   title: 'Tundra Sunset',   place: 'Arctic coast, Alaska (to confirm)', date: '',
      caption: 'A band of gold under heavy clouds, behind a snow fence and tundra ponds.', wallpaper: true },
    { id: 'golden-shore',    title: 'Golden Shore',    place: 'Arctic coast, Alaska (to confirm)', date: '',
      caption: 'A low sun blazing over the sea and a snow fence, the tundra glowing gold.', wallpaper: true },
    { id: 'aurora-sweep',    title: 'Aurora Sweep',    place: 'Alaska (to confirm)', date: '',
      caption: 'Green northern lights sweeping across a starry sky above snowy ground.', wallpaper: true },
    { id: 'aurora-and-stars', title: 'Aurora and Stars', place: 'Alaska (to confirm)', date: '',
      caption: 'Bright ribbons of aurora among the stars.', wallpaper: true },
    { id: 'frozen-sea-at-dusk', title: 'Frozen Sea at Dusk', place: 'Arctic coast, Alaska (to confirm)', date: '',
      caption: 'Wind-carved snow and a frozen sea under a pastel sky, with distant mountains on the horizon.', wallpaper: true },
    { id: 'the-hippie-tree', title: 'The Hippie Tree', place: 'Location to confirm', date: '',
      caption: 'A fallen tree painted with "The Hippie Tree" and "Make Love Not War", deep in green woods.', wallpaper: true },
    { id: 'river-bluff',     title: 'River Bluff',     place: 'Location to confirm', date: '',
      caption: 'Calm brown water, dry reeds, and a limestone bluff under a clear sky, seen from the water.', wallpaper: true }
].map(p => Object.assign({ src: 'images/photos/' + p.id + '.jpg', thumb: 'images/photos/thumbs/' + p.id + '.jpg' }, p));
