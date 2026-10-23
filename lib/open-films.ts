import type { Tutorial } from "@/lib/tutorials";

// Official Blender releases. Each linked license requires keeping the complete credits.
const films = [
  {
    "id": "sintel",
    "title": "Sintel",
    "description": "一名年轻旅人寻找失散的小龙，踏上一段穿越荒野与冰雪的旅程。",
    "duration": "14:48",
    "src": "https://video.blender.org/object-storage/web_videos/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40-720.mp4",
    "poster": "https://video.blender.org/lazy-static/thumbnails/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40.jpg",
    "href": "https://video.blender.org/videos/watch/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40"
  },
  {
    "id": "big-buck-bunny",
    "title": "Big Buck Bunny",
    "description": "宁静森林里，一只温和的大兔子与三位捣蛋邻居展开一场机智较量。",
    "duration": "9:56",
    "src": "https://video.blender.org/object-storage/web_videos/bf1f3fb5-b119-4f9f-9930-8e20e892b898-720.mp4",
    "poster": "https://video.blender.org/lazy-static/thumbnails/bf1f3fb5-b119-4f9f-9930-8e20e892b898.jpg",
    "href": "https://video.blender.org/videos/watch/bf1f3fb5-b119-4f9f-9930-8e20e892b898"
  },
  {
    "id": "tears-of-steel",
    "title": "Tears of Steel",
    "description": "未来的阿姆斯特丹，一群科学家试图重现过去的关键瞬间，阻止机器灾难。",
    "duration": "12:14",
    "src": "https://video.blender.org/object-storage/web_videos/8533ea43-4271-4a57-9694-e9d0b35e1aa1-720.mp4",
    "poster": "https://video.blender.org/lazy-static/thumbnails/8533ea43-4271-4a57-9694-e9d0b35e1aa1.jpg",
    "href": "https://video.blender.org/videos/watch/8533ea43-4271-4a57-9694-e9d0b35e1aa1"
  }
] as const;

export const openFilmAttributions = {
  "sintel": {
    "text": "© Blender Foundation · www.sintel.org",
    "licenseUrl": "https://durian.blender.org/sharing/"
  },
  "big-buck-bunny": {
    "text": "© 2008 Blender Foundation · www.bigbuckbunny.org",
    "licenseUrl": "https://peach.blender.org/about/"
  },
  "tears-of-steel": {
    "text": "© Blender Foundation · mango.blender.org",
    "licenseUrl": "https://mango.blender.org/sharing/"
  }
} as const;

export function getOpenFilms(t: (text: string) => string): readonly Tutorial[] {
  return films.map((film, index) => ({ ...film, number: String(index + 1).padStart(2, "0"), description: t(film.description), captions: "", actionLabel: t("官方影片"), steps: [] }));
}
