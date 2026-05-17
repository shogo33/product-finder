import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Heart, X, Package, Sparkles, TrendingUp, Layers, Filter, BarChart3, Smartphone } from 'lucide-react';


// 画像ギャラリー独立コンポーネント
const ImageGallery = memo(({ images, image, emoji, name }) => {
  const [idx, setIdx] = useState(0);
  
  if (!images || images.length === 0) {
    if (image) {
      return <img src={image} alt={name} className="w-full h-full object-cover" />;
    }
    return <div className="w-full h-full flex items-center justify-center text-9xl">{emoji}</div>;
  }
  
  return (
    <>
      {images.map((img, i) => (
        <img 
          key={i}
          src={img} 
          alt={name} 
          className="absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-100"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
      
      {images.length > 1 && (
        <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
          {images.map((_, i) => (
            <div 
              key={i}
              className={`flex-1 h-1 rounded-full transition-all ${
                i === idx ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}

      {images.length > 1 && (
        <>
          <div 
            className="absolute top-0 left-0 w-1/2 h-full z-10"
            onClick={(e) => {
              e.stopPropagation();
              setIdx(prev => prev > 0 ? prev - 1 : images.length - 1);
            }}
          />
          <div 
            className="absolute top-0 right-0 w-1/2 h-full z-10"
            onClick={(e) => {
              e.stopPropagation();
              setIdx(prev => prev < images.length - 1 ? prev + 1 : 0);
            }}
          />
        </>
      )}
    </>
  );
});

// 背景カード（2,3枚目）
const BackgroundCard = memo(({ card, index, x }) => {
  // index 1: 2枚目 - 通常 scale 0.95, y 20。 スワイプ中(|x|>100) → scale 1, y 0
  // index 2: 3枚目 - 通常 scale 0.9, y 40。 スワイプ中(|x|>100) → scale 0.95, y 20
  const baseScale = index === 1 ? 0.95 : 0.9;
  const targetScale = index === 1 ? 1 : 0.95;
  const baseY = index === 1 ? 20 : 40;
  const targetY = index === 1 ? 0 : 20;

  // 絶対値ベースで補間（左右どちらにスワイプしても同じ動き）
  const cardScale = useTransform(x, (latest) => {
    const abs = Math.abs(latest);
    const progress = Math.min(abs / 150, 1);
    return baseScale + (targetScale - baseScale) * progress;
  });
  const cardY = useTransform(x, (latest) => {
    const abs = Math.abs(latest);
    const progress = Math.min(abs / 150, 1);
    return baseY + (targetY - baseY) * progress;
  });

  return (
    <motion.div 
      className="absolute w-full h-full rounded-3xl bg-white border-4 border-stone-300 shadow-lg pointer-events-none overflow-hidden flex flex-col"
      style={{
        top: 0,
        left: 0,
        zIndex: 3 - index,
        scale: cardScale,
        y: cardY,
        transformOrigin: 'center top'
      }}
    >
      {/* 画像エリア（70%） */}
      <div className="relative w-full bg-gradient-to-br from-stone-50 to-stone-100 overflow-hidden" style={{ height: '70%' }}>
        {card.images && card.images.length > 0 ? (
          <img src={card.images[0]} alt={card.name} className="w-full h-full object-cover" />
        ) : card.image ? (
          <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-9xl">{card.emoji}</div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="text-[10px] tracking-widest text-white/80 uppercase font-bold mb-1">{card.category}</div>
          <div className="text-lg font-bold text-white drop-shadow-lg">{card.name}</div>
        </div>
      </div>
      {/* 下部情報エリア（30%） */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
        {card.tags && (
          <div className="flex flex-wrap gap-1 justify-center">
            {card.tags.map((tag, idx) => (
              <span key={idx} className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="text-2xl font-black text-stone-800 leading-none">¥{card.price.toLocaleString()}</div>
        <div className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg">
          AliExpressで見る
        </div>
      </div>
    </motion.div>
  );
});

// 最前面カード（1枚目） - ドラッグ可能
const SwipeCard = ({ card, x, rotate, scale, cardOpacity, likeOpacity, nopeOpacity, amazonUrl, onSwipeRight, onSwipeLeft, selectedTag, setSelectedTag }) => {
  const [exitX, setExitX] = useState(0);

  const handleSwipe = async (direction) => {
    const targetX = direction === 'right' ? 1000 : -1000;
    animate(x, targetX, {
      duration: 0.3,
      ease: 'easeOut',
      onComplete: () => {
        // Reactのstate更新とxリセットを同フレームで
        if (direction === 'right') onSwipeRight();
        else onSwipeLeft();
        requestAnimationFrame(() => {
          x.set(0);
        });
      }
    });
  };

  return (
    <motion.div
      className="absolute w-full h-full cursor-grab active:cursor-grabbing rounded-3xl overflow-hidden bg-white flex flex-col shadow-2xl border-4 border-stone-300"
      style={{ 
        x, 
        rotate, 
        scale,
        opacity: cardOpacity,
        top: 0,
        zIndex: 10
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100 || info.velocity.x > 500) {
          handleSwipe('right');
        } else if (info.offset.x < -100 || info.velocity.x < -500) {
          handleSwipe('left');
        }
      }}
    >
      {/* 画像エリア（70%） */}
      <div className="relative w-full bg-gradient-to-br from-stone-50 to-stone-100 overflow-hidden" style={{ height: '70%' }}>
        <ImageGallery 
          images={card.images}
          image={card.image}
          emoji={card.emoji}
          name={card.name}
        />
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-20">
          <div className="text-[10px] tracking-widest text-white/80 uppercase font-bold mb-1">{card.category}</div>
          <div className="text-lg font-bold text-white drop-shadow-lg">{card.name}</div>
        </div>
      </div>

      {/* 下部情報エリア（30%） */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
        {card.tags && (
          <div className="flex flex-wrap gap-1 justify-center">
            {card.tags.map((tag, idx) => (
              <motion.span 
                key={idx} 
                className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold cursor-pointer hover:bg-blue-200 transition-all"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {tag}
              </motion.span>
            ))}
          </div>
        )}
        
        <div className="text-2xl font-black text-stone-800 leading-none">
          ¥{card.price.toLocaleString()}
        </div>

        <a
          href={amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:shadow-xl transition-all active:scale-95 shadow-lg"
        >
          AliExpressで見る
        </a>
      </div>

      {/* GOOD/SKIP オーバーレイ */}
      <motion.div 
        className="absolute top-8 right-3 px-3 py-1 border-[4px] border-green-500 rounded-lg rotate-12 bg-white/30 backdrop-blur z-30"
        style={{ opacity: likeOpacity }}
      >
        <span className="text-green-600 font-black text-lg tracking-wider">GOOD!</span>
      </motion.div>
      <motion.div 
        className="absolute top-8 left-3 px-3 py-1 border-[4px] border-stone-400 rounded-lg -rotate-12 bg-white/30 backdrop-blur z-30"
        style={{ opacity: nopeOpacity }}
      >
        <span className="text-stone-600 font-black text-lg tracking-wider">SKIP</span>
      </motion.div>
    </motion.div>
  );
};

const SAMPLE_PRODUCTS = [
  { id: 1, name: 'OOZCC LCD表示 120W急速充電 USB Type-Cケーブル', price: 300, category: 'ガジェット', emoji: '🔌', color: 'from-amber-200 to-orange-300', url: 'https://a.aliexpress.com/_c3SqLqeV', images: ["data:image/jpeg;base64,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", "data:image/jpeg;base64,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", "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCADIAMgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDjDcE/dFNxI/U4qYIo6CnVtYxuVzEqjLGgMijAGamdA3WhUUdBSsFyHMjdBgVJHGQck0/IFKCCKdguFBOOtMfeOlRkE9c0BYe0qr3pFmVqYIxQ0bk4UZPoBS1HoT7hjrRuB6VEkbbQWBwaf5bAcUyRwORTSoJ5NLGp70MmTQBE5wcLQIS3LGpBAM55pzI46GiwXEWJVHSgxKTnFPVSRzSgU7BcaAAMUYpxXjioiHB9qAHE4pokUnFO7VG0YPTigCTNJUOHU8dKlGce9IBaKgfeTjNFFx2HSFweKaPNHNWDRRYLmh4Ym/4mjbm8srbzNv2524Q849qt3dxYXtjNdFXuZbdYoTMR5QdmL/MQPQAfXFZdlZyXk5jhdUbYzFmbaAoGTz9KttoV1HC3lTQS5RZBHG5JdSQA2MepxzzSaGnoaU+iabDcrGY7hhHKELRq7eYu0nJ4x2B+XtmlTRbbfJH9nPmSBTF87+XgqT97GQc84btVW10q5acRy3YeOJZQrRzHEUiqTgk9Onb3pbHTZ5J/39xJJFO0X72GY4dWfac5GT3HPSkMmi0WFrqQNDL9nEVuyvk4JcoG579Wot9N02fzXMMmwXJt9il3ZQB975QeT78cVl3Ol6ito0yTMIo1MixeY24RhsbsdO2fXvUNjpd/NbxzQ3SRm63LGnmlXlK9Rj/GlcdgsLZJ9XtbScvHFNIAHI2llz1GfXFbtutpp7zTwQSLJ9jmYjMiBcEDKlgDk5wfTHvVHUNJnuBbvDLHKYrSDEO794qkDtj+8315qOXRNQnkOLuOUgMjv5xIQqMlST7D6cUxaGq8dtfLCskZCW1hHKkW9yGLEZOACeOpx171Vu9NtYIpHt7S5u90jpgFlMACg8jHXk9R0FUYdEvklWRLqMII1ZbhZG24JIABAz1B4x2psOm3z3d3a+aYniBM+5zjAOOcZJ5NCB2NmVLVVldrYw2wtrV3EbECQErn8ufxpE0W1hmaC4y80cck2MnDruATheemW49qy7fR76dUj+1RYcskSNMcOFPJXtjNW5tLcC0a1n/e/ZxPNOZW+QHgcAZHoMZoQmXZLGzFstqPMWKW6IXdlSjtEMdRkjdjr2qhDp8J12z06RW6KtxhuS5GSB6Y4H4VJFpV1FtlluYftC3aoIpWJVyQCDn34/CqchvLO5j1JyvnPK5AbklgcEkemT+lUiX5mkLCzFo13NaSxFIpG8gyEFtrKA2Tzj5iD9OKiawtUt2c277UtkuPPLna5JGU9O5HrkVhGSdyTJK7HG3LMTx6fSmtLJsERd/LByE3HGfpRqGh1s+mWMmoXjvbMirciIRRh+FIzuAUHr27cVnS2dtapAVs5bpGAka43FVHz4wRjA44PfJrGF1MCWE0obbtyHOcen0qrJLKIzGsriMnJTccZ+lLVFKzNXX0SLWruOODyEWVgEHTGeo9jWWZQDgimG4klbMjs7Yxljk08KG6immDQGZQKjMjv90VIIVBzTwAOgo1FdIiSNs5JoqWiiwm7jqDxUSTA8NwalzmmOxPaXTWkjuihi8TxkH0YYJ/WrEeuTRkNGihhbpbq3PAVgwP1yKqW+Q5IKg7f4qlMT4ALxKmQeM+ualjRbGvtGzGGzgRHLtKmWIdmUqSeeBgnAHrUMfiKeBkSC2hSGPy9keScbX39epyetRMHj3OxjPGT+H/AOuoZA/DbogAQe/WkxotS65LcWf2eSME7PLDiRxhc5+6Dgntn0qeDVIrbT7FYrdJLq2MjK75HlljwRjg+vNUFafd1h9hzUkZl27tyZJAPX6UIHoSLrF1FcNMioHMCQZ542bcH6/KKsNrjqjrDbQxLLvMgUk7mZSpPJ4wCcCqc24sGzEGXtn2qNjMATmI4GcDPNAWL1rrs0MCW5jDRLGEIV2QnDFgcg5/iIqKG/MV7JctFuZ8nAkZSvPZgc+1MiSVWJzF1zyTT38xsbTERkHPemSXl1+RrhbiW1gkmjdmjbkbN3UYzz36+tRxavNGy4QFfIWBlVipYA5ByOQc1AqysQB5Rz7UxZ3Tk7aaRLdh9zqjPBNE8KgSSCVG3tmMgY6k88etGtanHe3xkQ/u1UKvy7c9yce7Emq0t0CRwpINMaZ3Odi/lR6BfuQGYt90U4I5G5gfyqyJWKgFF4x2pz3Tjk7celPULroVMUxog1TtqDKRtVcg54FVg0jn0FK5VhfLAHFOHA5pTlV96iEoPB4oDckzRSAjtS0xBRSE460UADxK3saixJEfUVYpAwNKw7kaTK3B4NS1G8KtyODUR82PjrRew7XJ3CkfNUGxS+Ac0gVnb52xUyRKnI60tw2GNEy/dxTlRu5xUlIzKvU07CuII1p4wOgqMOGI2mnFgOpoAdmlDYqEzZ+6M0Kjv1ouJ+ZaRj1B/KlYZHJp9pazTfJBE0h9hV+TRLyNFZxGNzBQN3OTVpNo551oRlZuxlKinoKk6Crl3pN7aR+Y8OU7lDnH1rOJJoasVCSqK8XdD2bBqFxuPJOKdRjNSapWI1VQM4p2ecDinbfWg4HbmkO43nvTGjVu1SZXvSAYJOaYXIDGycqaPMfpt5qxxSqjSNtRST6AZpWDmKojdvvGitaDTJHAaQ7R6dTRU3RVpGU05PCjNNCyMeeKnCKOgxS96dgv2FXhQKXrSUHpTJGSw7+QcGog8kXDDIqxGccE5NOKg9RSsUVDK78KKVYHbljVpUGQFXk9hU/2coMzusI9G5b8v8aLBcoNbleUNPgsLi4PyqSPXoPzroP7FuFtlmtoY5SyhgZGyfwXp+pqvaatdWJZHiRpQefMU5X2HoKrk7mH1hST9n7zQtv4flSHzGiaTvgEIPzPP6U/7JqUcImgthHFgNiMAkj37mmS6jqWpv5SMx3f8s4hgVsacmoWNvm9uIY4QPlEpyR+NaqKOKrXrQV5NX7aluzkjubFVsZ1jIXGNg4PuK5fVVvIbzbdzmRxyrBuP/rVc1HVF+1brUxsRyZEUoSfzqfTb2yldnuYIzJ1LsMsfw703aWhlRjOg3Ucbp+l/vKUPiC+hiEZdHx0Z1yauQaVFq1obgXEYuG5IiXCr7EevvTtQ0rTZ3D29ysLO3IByv1x2q3YaVa2hDwCe6lYEboyQPzHA/E0rP7WxUpwcb0E1J9l+Zy+o2NzYvsnTbn7rDkN9KrK5VRk13Nz4Xn1WRZJ5jboowqAlyPfms2+8BSx5aDUFkH91kwf51hKST0PUpRm4L2m5zW7NGa0P+EbvI3A86Lb3Jzx+GKuQ6SkaHG1pR0aQZAP0pcyL5WZEVtJNyiZA/iPAH41a/sq5ZN0fluPY1YbTN/zajdmQDoi/KoobUrWxhENqvyjpzmlzsrkXUji00KMztyOoHGKuhIrYJkLGjdelZQ1mZy6kAK3fHIqrLcs5OWL/XtUttlKKRrTajHHvWNN4box6CisJmPG5toPaikMlpCQOpqBp2bhRSCKSTrxWtzLl7kjTqOnNRl5JOgqZLdV681KAB0FGoaIghiZW3MasUUUwL8eJ4QtpILeQDDKeN3/AALr+HSs+eKS3crMjK3XnvUkMvlSA9uhrVD7o9jqskR52sMj8PT8KpIwnLlepR0/WLuxGIn3R/3H5H/1qvwXJ165FvdJBGcZEijDfQc81Vk02OXm1fa3/POQ/wAm/wAaphJbW4XejJIhzhhiqTezMZUoSbnHSXc6BLSbRZXcwyXFs33pIWIdB7juKTULbTNQtjdW96quq5w0mc47EE5BqvHrl5a/IpWaM/Mhk5OD71lapi8k+2BEiLHEirwAex/H+lNySWhzU6NSU7zdn3XX1RrW+kWMUKz6hep0B2Iw/L1NTrFY3U5g0y2Yyo2GbniudsrSSQmZAdifdZhgFu31x1/CtK0u7myUQ2KPISf3r4ADeuTUc/RI6Xh3fmlNv8EdFbaTAhDXMm7HXb0P0/xrUWVLZB9ld4yR91xkEelY1hqEd24SQ7H27ipPUeoq/u3sT69qVr7jUuXZGomorLEd5ELKPm54+tYer+I4dPTKxvOT0ZfuZ+tUrycySFP4RxVMQNCCzuI0bs/8Q/3e/wCVKVNLVF08TJuzRWh8UTXN232iNFVvu7R0qxLq0ZQ8YJFUri0tHlVreNk/vdgT7DtWXcq0UzIT06fSsTuQtxdTzOdznFQYA5NGTSdTgDJoAdn24pQGOcDaDTSjgA9/SlWbnDjBq0u5LfYci5JyMmipA4I4oq0kZNskESDoKUjFKG9aCwFMV2htFIW9KbSKHE0hJpKCQOtABVyxkdwYSenK/Ss55lXpyadbtM0iyKwQKep/zzQpWJnT542N+OIqOadJMiqIpgJV7RkZP4Y5FTR2zz2wnWUPAepj4wfQ9wfyoSJIgRGgHrx1rXfY85y5HaW5TbTjcxJ9ncwlScJLgtg9genX8eakttLeMlTbSOZPlDTcfMORgGr0LQkMsybs9CDgirMUCnbJKTNEB0JyUo9ncl41x0sUVtk+xFpVd5wfmhLFdv0HekFrHcB4LYsmRzFI3U+xq7PY/bblpoLuRpAMKgXBH4+lJPe2umZbUb/zJsYMUIBb8T1/lSbjHRlwjVqrmi7+t7GONMBlEbee0rHLhOWGOg/rV8Xsmmqw1J/LjI/doTul+nHGPrzWdc+JrubMOl24tUbuBl2qiNNmklMt/Mwc8kH5nP8Ah+NYOXY9FUU/iLq6tNO/+jRCBP7x+Zz+Pb8KbErNdyByWLjfk8/WnQusD7be1E3bDHhfx9aqXkN15i73wz5wq8AD0qW2zWMFHRItzXdvb8M25v7q81k3c5upt4TbxgCpkt4o+XO8jrjgD8aZI6tIGUKABgYoSuNuxEtvuOWOB6VKFRRhRUlvHJcZEaFgOrdvzqYWE6n94oRem4mtNEYvmZVxjt+dPSyabDbcKT99uBVpFghb5Rvbsz9PyqGa8GCCdxHTFJz7FKHcfDa20Dn/AJav2LcKPwoqhLcvJxnAHaiouaWHk5opSKjaVV75rUyH01nC9TUDTMxwKUQO/IORSuO1txWuOyilWF5OWOVNWrTTZJwTHGX7FjwB+Nb+neF5XIaUnB7dB/ifyH1pX7hvsc7DZ5YBFMjHoAMmum8NaVI1/H9phtljbITzRuLEDJAx0Pt7V0VjodvbJgID6gDAP+P45q7cafFcQeU4KgEMpQ7SpHQg9jUt3LStuUrrRYg2bXNhcdFYco3t9PY/lWPcR+RMIdQjFlcH7so/1Mn4/wAJ/SukW6ubNfL1BDdW3Tz1XLAf7a/1H5VLcpDLYFlRb20brHndgeoPtRGTWxNSlCorSRy39nXDFg0Wzb1ckBfz6VUu9SsNKYxyGS6mx9xPlX/vo9fwrQ1rTbH7FPaGd98GDH8x4H90jocZ/l6VgJp8ltHtkxLB/cfkD6dx+FW6knsc8MHTg9dSvPrWq6oTBar5ER/5ZwDHHuetMtdIiBLXM4LDqqHJ/E9PyzWgkMsi7FURxf3QNo/Lv+NSmGC1UNMfpn+grPc69EhINkS7bKAL/tnv+PelaJQ2Z33Mew/z/OqlzqLFSIRtU9CeMj/P/wCqoLQQTzAXk7ovYYwD+PaqUHuQ59EXTOZCY7do49o6A/MfpnisppGuJcRRs746H5j+NWNQj0mCXcHkkI/gQgD8TVP+2Jo2H2ZI4Y1/gVeD9fWi66Iai+rJV0+5mbDqwx6jAH+fapm0trSASLH9pkz0Y7VX3x3qxFrCyxhtoB7j0NUtSvTMg8tiCOoqWykiKSSYMHuLtlK9Ei4Apt1qk9wcAkD0qntLHLGnAAUhkklxJIBubHFRgFj0/GjPtk9qAwLYfIx0FNK4mxeDkD5jRTx14xiir5URzMjYTOehpVtmP3+KtLxTwQen5VVieZohSFU6CrumLE2o26zbfLLgEN0/Gq5Hp+VJQF7nfWctrbyiOeHyiOFk6gf4VvJGuARgg9CK8/0/XeFh1AF1HAmA+YfX1rpLK6ktEWS3dZrZuQAcqfp6GsmrGqdzoAlOwACTwB1NYN/4kkiZYbDT5bid1zl/lRfqe9YN5Jc6g5Gq3zz462lr8qL/AL3b8zSGdBf+KNPtpDDa7764HGyDkD6t0FYU9xeXExa7aKxRgcW9qD5hz3JHP9KoTalDaRmG38uLH/LODr+Lf4YrN+3M7YO6NCcnyvvH8T1q1Ehz7GrY6l9kt5SYUeVpl/fyggtz6fXn8e9TyzoB5krfO3zCMDn8qyiXnjKqdsTcYI3Mw9z61tRWKqTI+y3SQ5CKPmPsKuFNyMK2JjSWr1Kb3TsvUQr7jcx/DoP1qI2lzJE8qwbFxzJKcs/0FaLT2dsJDEI98YyS7AsP6D+dZ17eXbylZZRDEVz5kZ354yBntn04q3yQOeE69Z3SsvMy5DHETvbc/wDdHJqo8zSH0HpWkFurRCWtLeSBV+Yqoyw+o5P4elZ7W7Md8REoOD+7Gduex9KznVctFojtjSS1epBImeR1qMKTUzqySFZAVI4P1pUAIzWRqMRCuSKCakLqvTk1GAWOB1ppCbAn3xQoLHCjNSpBnluamVQvT/61WoEOZEke1Dnkk0xowamYjGBzTKuxCb3IPmiPAOKKn27uMZopWY+ZdSU9aKftHuPwppHccimJMUEkgH86Mgnng+tIvUn0FA5NAW1Fx+P0q1YalcafJugf5T96NuVb8KqcqacVLEbRnPpSsCZuXWvQTwgLBKpP3kEmFP1I7Vlz3ct0nl8RIeAkfyiprTSLi5IJG1f1rYstAVHG794Qc464/oKuNPS70RhUxEFKy1fZHLQ2Es12LcfKx6E9q6C10dLVl+1FdwwdoO5jxzgfWuji0cBTsPksT1QZP0yf6VzOu2l+l88EVvOIdu7nGGA6ksOv40ueEfNilCvV0+FfiW5L+G3jJhQhFIV5EXdj6noD9M1SN3HeCaSO6+WNwCjqVEi+7ZzUdrd3kmntZu8SW+4LulPcg8bRyaaYLOwDM1158mzAXYDtPQ/L0A9zWcqspG1LC06etrsW+WDUpInitlgRVChF4H44681NboLWRH2RuVBCpINy9OuKqRSh2LW+5CoO5ZGHUHGAe/0/WpYjd3eRbQMoHVm4/U1mdJFAt1bx3Uj3NvDGoAWOVuXz/dOKzLZTcx7YSsc+8FRkguSRgenHX8a1rVbeSKfesrzZ2jOBg+v/AOuopLJ3hj+2zKiJ/EeWPtmqjFy2JlOMdzPc+e7rdO/nRrsREXOSPpUPkys+wIQe4rVjnhh/d2EOCeDIw5NV5xcJKsNuGaaQZOBzitvY2XNJ6GPtnJ8sUMisYYyDdTKn+yOTTruK3guTFFlivXPrVzStKgW6V9Tm+YchB0z7mt3UdPSdN8kZlGOJYv8AWD6/3hVpKUfdRyVa/sqijNv8l8u/3nJEj6/yphyevNaFzpkkEZmiIuIf76dv94dRVHLHnOBUNPqdEZRkrxGYPpS4A+919BTucdWNJyPuqfqaCriHOOTtHpRSMMdTzRSGkPBPqadngHoTTabKx2DacEevegbRI3DccUqqZDgD5vbvUUUu75SPqD2ro9N03yow8jAtvDrtIIxjoaLrqKz6IzbDT5Ltip6D+HvXQaZoiQjCLvPt2Pua1tLsIHt1dRuHQjPHHHP/ANetiOFVAAFHtVH4VqZyw86j9+Vl2X+ZmwafgYfGP7q8D/69X4oFQAKoA9qsBBShaylJy3OinShSVoKwxUApJ7aK5geGdA8bjDKe9TAUtSaHH+IfCyNbeZZwuxTaFSIDcB3Jz97t71zkFmtiJFvUEkiSEYDjYykchse+OlejXOpwwt5cWZ5ugSPn8zXPaxatJKl3dWkBlfKhAD8vucdTTSbJclFXZgJcswSaSBZBgBEUZGO3+TS29s6PK5Yqsh+6CTgelaEVrjlhio5GCk4rS0VvqZ805baIrMRbrtii2j1xVOcCf/W/N6Z7VdeUdKhkhDIXTt1FO0pLQn3Kb169SvEqxfdGfrUkbkMT3bqfWmYoAqHUk92aqnFapEkhyc1PaX9xaH922U/uN0/+tUBBxzQBT5rO6IlTjOPLNXRsxy2t+4eN2tbv+8vf69mqhqOnqCTdRiB+1xEMxH/eX+GqyRtIwVFLMegFb2n+dDEVu5QyngKeSPqa3pydTRo8rEUlhfehL5dfl/wdDkru0mtCPMTcrfdkByrfQioOnXA/E12c2lgBmsXWMNy0LDdE/wCHb6iudvrCIPKFVreeMbnhY7lI/wBlv6GnKDRph8XGroZoCk8YJ/Gim5J4UYHtRWZ22JCAOQcimNhhgjir1lpc12vmZVIv7x5/StGC1sVUpBC10/cnoPx6Cp32L2WpjW1nNctiGMsPXsPxqewvbnTp3hYh4gxBXPA+ldNbWgdQLg4A/wCWUfCf/XrmNUiMGozFUxGXyu3pj6U9NmJN7o27O9e1nNzby4R2zntz2YV2Gm6nFeKFYeXL/dPQ/SvL47ma2+eNuD+INbemX5mTcq/MDgrnkf7v+FE6f8o41LfEei0uKwbTV5ysYBjlGcEtnd9PrUF7eXV3zI5jgzjy4zjP1NY2NXJJXNm71O2tflLh5McKvP5+lZzST3zYupvIh6lIzjPsTWZMwSH9xCMH+Jumf51izarfQ3WbsB0PG0DC/hWkabe5lKsre7qdY15bWaGOzjXPc/4nvVCaeSc7pXJA6DsKpwXcd1HutzuPdTwRWlbWoaDzJefatI0W/iOStjYU1pqykhMzlIhkjqfSquoWbwJvzkZ5IrbWFFIaLG49QBVeWB7htsnEYPI9a6FShax5jzGq6ik3p2OZOe9AcitrVbOCO1LooVgePesLvXNOLpvQ9jDV44mHNYfs3HipAgXrUaMVqdYGKebO4hi/vP3+g71mld6I6JTUF7zIyd7YAqwLVY1D3T+UvZf4j+HaqcurQ24K2KYPQyvyx+npVeFbi9lz8zM34k1vCkr3kc1SrNrT3V+P/ANUX8aDy7ePYp6n+I/U0+3Fw8wEGXB6g9F+pqay0hVI885b+4p5/E1uR26QRfPtjQfwjiurmUVZHj1Kiu+RX82QQROAVU5fHp8orE8SQsIlkPlF1yC68E54xWlf60sSNHagM3TOOBXLXc7eZ5t7IXduw4P4Cspu61NsHh5KamzNIbdhc5PpRSTymQ/KAg6HHf60Vyctj3L3LVpfTWM26JvlP3kPQ10lrqlvcImAULdA3Az6ZoooloJK5qWk8eGRh14INU9W0czxNNbLvI6pRRXRDWCPFxMpUcT7r3Vzjri3lQkDIweUPrT7d5Ixt5VyQdv8XGecUUUvhloenF88NTWstVZFAZyuSo3Drn1Nb9nqIt/mnUTwt1YdV/CiiraV07bmUldNdi0YYpHL2MysrAEp2x6f/WrOltorpHTbh+8bDFFFC1dmefOTptyhpYy/7FnhZZraRk54BOCK0oNWa0m+z3uY2I4f+E/WiirtZaChN4mfLU8zVSWMruVsN1FUrzUQJ8qQD7UUU3ornPh6UZT5HsZd5M83LsT6CoYIWP7zaBGOrOcKKKK5n709T2ZfuKPuEVxqVnaE/ZwJ5v77D5V+grImuLi9k3yOzk9z0oop7uxrGCiubd+Zp2eiMAJbxvJXGQCPnP0Hb6mulsdOYRhYk+zwnqTy7f5/zmiitH7uiPLlUlVV5Ekuo2lhmKAeZL045P5/0rKurqa5y00gVP7oOBRRTW9jaNOKipdTKmvxGwWIDGD82Kzb7zDskk4xwATz+VFFZzeh2wilJFcgzHCqQucgdW/PvRRRUKKerNXJp2R//9k="], tags: ['急速充電', 'LED表示', '120W'] },
  { id: 2, name: 'スマート目に優しい モニターライト 1400ルーメン', price: 2700, category: 'ガジェット', emoji: '💡', color: 'from-yellow-100 to-orange-200', url: 'https://a.aliexpress.com/_c3SqLqeV', images: ["data:image/jpeg;base64,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", "data:image/jpeg;base64,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", "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCADIAMgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDigi+gpwUegpBIo604SpWepegopQORSCRM8kfnTxLEP7v50WHcWa2+88Y6j7v+FU8jdHxjDYJ9ea045VkHBH4VHcWvmHcvDg5+tNMlrsZ7x8Bh1qccjNPMX7s9mHUGkUYFDY7CqKlUV0SaRpc9pE0cyxylIBIC/IZhkkZPfp7Gq9rp9smrmB0aZPJ3iNiNysQOCARuI9AaVh3MjFOArdfRbVrkKJiqNMULRspSMZxjk5J7/wCc06HRLKaOCRbxwJQWCkDJ4J2j3496LBdGDilArVu9MtoLSSSO5aSROQOACN5X654zV6HTbJ0iJSLycxYkMhDSZHzDrjg544xilYLnPAUoFbUmj2sNms8ly2fL3FVKnn5cfh836VBqmmrZN+4kMqAfM2OhyQPwOKLDuZ4FQzD5/wAK6ebS9PdSYJMHeFKBstkISQM+pxg1SjsIReXsYiS7aJFMas+3JLDPII5AJ/KiwrmEw4FQN/rK6efStOJyt1sj8zYrKQesjKCcnoAO1QXGiWkTyN50siowDBSoMYwD82cdegxTsK5hDpSGtp9MjeTVYbaItJBKohBcZ27jnvzxVgaHayRiXzG+WNWYIRtUhUJB5zyWPT0p2C5zvcU4DrXSJo+mNcPsZ2UygKGcYQeYVOcHkYA/OoI9FtHRSlxIzBQzICuWJQNhfx45osFznwPmoq3qFqtlqc9srFlicqGPU0UmBkC2c9xQ1uUUszACrAlXHzcYqAlrh++0dBVJsTSIkjLnjv0qyLE93FWYIPLGT97+VThalyGolSG2MLZ3ZzV1D2NMYcipUXNK5VhssQkUjoexqoUZG2sMGtAZHB6UkkQZcMMj1oApCngUrRlDz07GlAoGhQKeBSAU4UgsGKXFKBS0APghM08cSY3OwUZ9TVptOukJVULjAY7cj1xwcHNVY3aORZEOGU5B9DViO9uUQIspAAAHAzxTQmKbG4VlXy85XdkEEY47/iKhubG4XYWiOHO1enJqyL+4xgOoHTAQYxxx06cCoLq7mk8sSNuRDkKAB/KgWpC9jcCISGEhcbu2cYznHpUDafdG5WIQnzGBYLkZwOCT6Vck1G5ZmcuvzsSRtB4OePpyeKqvfXIvTcCX95grnA5BOcYpiHJp12wb/R3+Xr/P+tTR22oKJrNXaNdm94i+A3QfnnFA1G52qEfaAmw988k5575JprX1z5wm8z5woUHaOADnp9aYDW0q7VQWjAz23Dj3PYCpbS11CGc+RHIkq8EqcEe1INVuPM3S7ZVPBQqACMY9KkGqXZcsJApJJwFHf+dOwjPkLPMXdizsSWLHJJoob7/40UhmVzM+BwoqygKY2cYpI0CjAqUChsEiSO4HRxg+oqwpDDIIIqrtpApU5QkGoaKLbgcVIg5ql9pfIDIT7infbCgyY2/KizC6NDANA+Xg9Kzv7T9Eb8qP7SJ/5ZOfwpcrHdGhJECvyjI9KrFMH2qBNTY8RxOcVYhm89SWUxsPXvTs0F0AFOAoxSgUhgBThQBSgUAJinAUYpwFMBQKiuB0+lTgVFcDpTRLI1QunHYZqrKP3lWjlU471Vk/1hpiJVHFDDgUsYyKWTCpliAPemgISKnQZFU5LuJfu5Y01dRI/wCWY/OgRbdcNmiqX9oFm+ZBj2ooAcBTgKAKeBUlIAKdiikJJ4AP+f5Ukrg3YhlkaB1dFVjn7rDIP4VtWWqWTxiO80KJwR/rICyN/WuaN1LyA2PpwfzqWG5j3DzQfr1rS1kZ7s6YWugXh/0XUJbOQ/8ALO6jyP8AvoVHc+GdR8ovbeXdRf3rdw+f61hSPG7qltgs3VvSrUcBjXG9wx6kHGaVx2YwQyWUuyeJ4x3BGMH6dasLhhlTkUz7OpOSxY+/Na1oulyW8cVxazJIox50MnJ+qnik2mNJooAUuK0pdKiKlrTUonH9y4Uxt+fSqBR1ZldQCO6nIP0NRYtMZilFLilxQMKcBSAU4CmA4VFcD7v41MBUVycGMj1polkTD92KqSD94auyDKVSc/vDVCJd4iiLt+A9ay55WmfLHOO1X7uJ2jjI6EE1Ta3dc5HYH9aVy+R2IKTvUoibyy+OKYR1qibDCOaKd2ooCxoCnCmin9qzBAeSAOp/zmpFQBcCmRcjf/e6fTtUoNDfQFrqbHgrTLHUdLu1vLWKYrNgMw+YDHr1rRuvAmlzZMEk9ufZtw/X/Gq3w8P+jagvpKp/Q12AroS0MG9Tz678A30WTa3UMw9Gyh/qKyptI13TwS9rPsHdRvH6Zr1SRlUDcQMnAz603OBRZDueSpqciNtnhGR1xwa27B1mjSROjetdvcWltdDFzbxTD/bQGuR8lLe+uIYlCRxzMFUdAM1jUikrmlOV3YtiEMvSq01tjpWhAMipHiDCua5vYwGjKmm7a1Z7X0FUpISp6VomS0QAUop2MUYqhAKjuRkJ/vVKBzTJwSEx/epolkcg/d1Qf/WmtCUfu8Vnyf62rexJqWKGRQCuVXcRxnPHIqter5TKGeAxlSAQ46H+ueavWjizt1MqEiVd2eyjoKvtBaJHJMIVaZs/eAIIODnp70KK3NVKWxysUiOGjyrE88GqbR7ZCprZdQCCFA5xwKoXKbbkfWoUkzSUXbUo4oqcx43e2aKq5nylkUknICf3jj/H9Kcopq/Nc+yD9TSRD2JwOKeopAKkUVBRsfD44fU19GQ/+hV2amuJ8BHF/qieyn9TXZhq6lscr3KWr6Wup+SWmeMwksAoGCTipmfdKsXI759an3dfpVZv+PuMj0NK1mFupKrfOUPXqPcVyd0v/E3vP+ux/kK6p+JI298fnXM3g/4nV5/11B/8dWs6vwmtPcuW68CrISmWy5UVaCVyHQV2iz2qvNaA9q0wlBjBppiOdmtSp6VWaMiulltgw6Vnz2fXAq0xWMjbTX7fWrckBU9KhkjOKtMhlaY/Iazpf9ZWjKMqaz51xIPpWnQk2dCuds8cU37yEgqUbkflXQalG17afIAFh+UEdCPauS05zFcxNkjBzkV1V/q9tCvlRkEPycdKroVF2Zzc8BXII5FY93IDM2PrWxqF4JWIjrPawZozK2axUbG7qXRnmTdn3ops0ZX7gOF6mitFEyc7F5abajc8je+P8/nT1pLMfI3u39BUdGT1RZUVIBTVqRazNC94IONb1JfWMH/x6uvnlEMMkpBIRS2B3wM1xvg87fEt6vrCT+q1r+LrkW2nxMCyy+YCjA/dx1/Q11p2jc5JJuVkXNJ1Nr23ku59sEJwEBPT1Ofc/wAqlhuYri9ZIjkwuUb0rmdGuDf2cll9+Pzw5IGPlxk/rilg0g22oqWuNkZlXaqjOTxjmpuxpdGddIykKAwJyDj8a5+8X/ieXf8AvIf/ABxau2c6nV7uLBJEnBJ6AE8D8aguFzrl19Iz/wCO/wD1qibvBsuCalZl61T5RVoLimWyfIKs7eK5DoZFimt8qk4JwM8UsoMStIMsByV/wrNv9aitoGaFWkYgbHAyoJHGf1/KqSM5TUVqLZapDfXMZgk3QyKRgjBVxzg/gf0q7OAuwbcl2wBXIQPLbSPchsMmJMjqvOCcf8Cro4o7MPKbpjMyHYWkO7kAE4H1IGKpa6o5qddzWiJJbVX3bSDjriqEtpgkYras3S5O6FtsKrt8pkwQc9c/0qSS2DHpVdTpTujmY7OMNm4BEf48/pVDULIby0SrtHAw24fnXU7T9qaIXiHA4t89eOvHNc/qEYt5PJjhWNScr8xI5zxk960lDTcqErdDHDPbyqXHy55xWkx+Q88EVXYM15CrZ+8CM+lXJ06046Iibu9irZyRFzHMgKtwG7qa0ZkjNkUAAYVjJGXfYF3E8Y9adFqLRxCCaFmkbMaFWHPYEVaVyOaxmXKSzOY4xiMc5Ixge9Fbr2BaM/OEhhJ3Ow/1jf4DmiteQz5jIHSltR+7P+8aB0otPuH/AHv6CuXodHUtKKlUcUxRUijisiybwv8AL4snH96A/wBKueNZJHktrVU+Uqz7uep4xVLw78vjAD+9A38q6TxAA1gT/dcf1rpbtTuc6V6iRleF7f7FaXZfHmHZ05x14qykyPryluq52D0JHJ/lVHRLlVjlMsgVfNXJJ9j/AIVXuLiNdYgnjyBwrEjGSOv9KzUm4XNXBKpY1dGDNq16zjB85v5mpp/+Q7ce8UR/9CFQ/afsmqS7I2Z5nDqoH3hgZP5midyPEZU/x2qn8mapt+7YSadRJG7bfdFWCOKrWh4FW650WzKvrmW1dpLdxOU5e2bhiO5X1rlGgjn1Nvs7A27kSIScAKRnn6ZP5Gux1W3t2tmknmeHb8wYZOD9K4dJVWXeoyHkO8KMAj156Z61ta8TixCurDtQP2a4dotz+YuxQRgsh74+o/UVq6DaXV65leWRUYneBjJycnntznpVeO4tJrNzOjGZiDuzt24PP1rc8P6hp0FnDaLOFmPUMMbifeqcXFImEI3SubENvFAyhGYYXaF3cY/3elTlRg8A8d6BQ/3DjrSUtbnXYxXeH+244TaFLqQExzo2O3TNZOupdLdyeaQVLYUnBPvWneTTR38du2NzsDb3BHMZ9/UVS8Rhlnclxy3OPpzXQ9Vcl7pGAC321Af4Rk1oTj+VZ9tGTdNnnHf8a17pBGhd/lVRkn0FS9AWpjukn2e4eL/WKvGD6nFVNNt5J7oiDLy7wuRztHrn8Kku7h5Y5preTEYxGpHBwcZ4/DrVnR3fS9KlvEHzvkLuP4Z/nW8Y9DJsh1ya6gP2YtJtB+bnjPpRTYbuFnM1wGMzcqW5A96KmU0mNRbREvSksf8AVn6j+QpUPFJY/wCrP1H8hXP9lm/UuqKlUVGtSrWRYmkN5fjG2P8AejYf+Omt/wATXcNvpp80nc7DYB6ggn9K5PTpW/4SS1mHO8ttB9MECt3VbCfVzGshKrGc57V2QhzQsck58s7mVFcRW+j+YykyvchkHsMA5/M063tb3UJ1HkgweYfnPG0ZHP6VNO+laMgR2a4nXonUg/ToKomfVdeGxf8ARrP24B/q1LljFajUpSd0bF7rmn6W5isl+13bcEqc8+hbv9BVS3bUm1KC+1FkTzT5SxAYKjkiremaVbWIBiTdJ3kbr+HpVq8uYrXy/MaLcTkBz09656lW/uo2hTtqzbtWwBV1XrmU1yCCURSMhc/wqcmuijildAwQ4IyK5rM1dg8wNcEdgMUrQQPy0ETH3QVXuEkt51dh/rOMfSpFkYj7pr0aVnBHNNalXTo53WQ6hYWkJB+QRgHIq8kUCn5YYwfUKBUZdv7ppN0igsB+Ga2SSM7Isq9Kz8Hmmray9yKVraTH3hXmSu22jqVkjM1a38+zDAkPHyCOtck9xcQylXlkYejNmu6ktpCOWUjGCPWuR1a2CuxA6VvB+7YLK5AkqyYK4Jzjip9Y1IR3C2MY2mUAOx9D2+lc+97NZyvsyhOCr/1qWSa0i+aQtK7DduByyHHr6GtorW5jJ9DSv9OtYpba1SRhFKeQvJwOSQff+tTlbC8PlLIfssHCwnvjsPX61DY6Y8iLulPnzLgkH/Ur6e3HX64qjq0A04ARsHTohHB/Gtm7IyW5X1iOOOTFv8pPOz+6KKoRytPLmYkjPzN3ornbtubWuX06UWf3T+H8qah4pbU4DfhWfRl9S8pqG8uTHGY4/vsMZ9AeKcrcZ7e9UmkElwcHPzlvwHA/rUxRTZOtxDYavYTyg+VEPmCjJwKn1DxLqGrS/ZtPjaCM8AJ98j3Pb8KqG0+33EaF9qqCSR161v2dpDaRbIECjue5+prZSsjJxuzN07w/HGRLeESyddg+6Pr61vog2gAAAdAO1NUBRuY4A7mp4b20t/mIaWTsAOBXPOTZtFWLtrYO6bnJQEcetVm8I2E0xlnaaVz1LP1rQs7ua4G9ohHH2yck1eRwTWKeo2irY+HNMtWDR2qbh3bmtlQAABUSHIqC/v1sYgxRndvugD+Z7V0RstTJli4aCJPMnKKB/E1Ul1LT3fYjhm9FQn+lc9d3VxeS75iT6AA4H0qM3F+kXlWd0LZepIhBY/iaV22PlSR1oaEjPlt/3wary6hYwnEp2H/aQj+lcey6mSWbWrjPsuKVp7sxeVcahLOmc7XUD9cZquXzEkdf/bOn4z9pQfXNWi4IBB4Ncro2n/aJRcTKfJQ/KD/Gf8K6TdQkwaXQJGxXFSXMtz5lpJH/AKbHIylTwGXPDZ+ldhI3FZWq2rXcB8kqlwnMbkdDVwVnqJvTQ4zV0eWeOzeLZITnA5GPUH0puk6Z9pSRpeQTsiPq3PP6VdlsJp5A9zOiXsecjdz9fpjnioLG6k0tXMw+fdgRn+Ef0roSMm7hK0+kl1Lspbl267/Ye1Zst2+o3OW4duAvYCp9Rvv7RbjJQH5V759armya3QseR1YjtWcpFRiTz2kUMO5ThugH940VVhkmnfO7CoMAntRWW25p6A9x5TquM5702aUxxbVJBbHI/Gi8tZUEbnoVyKrsWkxkHgYHFWkiW2WfPYssbFmIHWn2ce/cxOBmq5zFtYMDwRn0qdCXtSyE79+CfUYpNdgTNKydPtgCdkOfzFa7XMcEYZzk9lHU1zMDXEUgdAuR61YX7XI+Sqsx7k1L2LRovdTXL+g7KO1athabcPNy3ZazLKK6iO7yYSfdz/hWrby3Wfmgj/7+n/CueV3sao2YiAm6Q4UCp4SXOcbR2FZ8XmyYMu3joq9BV1JlQAEgfWlGAmzQjbFTg1ShkBqwrV0JWMWTZpjSVFNLgbVPPSq8kp52g4HyjjvVkk7zYPHrVOe4cPEoP+sb9KbK7YY9lGPxqvv8y/jXtEhP50DRf30bqjzSF6dhXHO3FV2anO9QO1UkJmZqs0UNzDI0SsRy7Y5x2Ga57XpIbqXbCQcD74/lW54gRmsXeP7/AAAfz/xrj7RZEkJdSVB+ZT/EauWxKGRRS2zCUgqT909jUk995wWM/KAeSOhNXLy9SSHYg+duCp/hrN8mJYyxY7zwFHb3NY77mu2w6RvOumVF2p0UdKKrEvkc8iiiwrmver51gxHWM5H9axlR35AJrZaTEDqedwqlG2KSdhtXIbWAyNIpyML+tXLWMpZkt1dgRSxgK7MOrYzVhVDLtUYAobBISNCSBWlboqDJqtCgWpmOVxWTdzVEq3m+0d4pEWRTgAnOeajXUZgPmvFQ555HT8KzHgYSOFhDnOQSOCPSp4rS6fIjjVc9DgZHt7irUERzMsTXrzOAbyVox2Tcc0STCRo8JKNvTIAJ/M1ImkXUmd8hQHnjsfY/0qzHoSHPmOzBuSBwCfX2NWkkrEtu9y5aeIGBTzlRVX5SQ2SzenoK6SG43oGXoRnmufh0i3UklNxbqWOc/WtiEbFCgYAFDEVZ9JSaeSUzyjexJC03+xoR1mnP/Aq0N1IXouwsUhpUA/jlP/AzU8NvFb58sHJ6kkmnF6YXp3FYlLU0vURemF6YErPULNSFqiZqpEhMqyRsrDIIwRWRc6cGtxFHIFVfu5XJH41qlqrvVCscbf2LWcql237s/NVeui1mDzbVyBynzCucrOSNIjJFIIYUU5hlcUUITReLbo2+lVVPNFFQUToauWhyx+lFFJ7FLcuKKnjiz1ooqEUy3FCo7CrkagDgUUVRJKBUi0UUxEitUytxRRQAb6YXoopiYwtTS1FFUhMaWppaiiqJGlqjZqKKYEZaonaiimIqXBBUg9DXJXIMM7x/3Tx9KKKljRFkH7xOaKKKQz//2Q=="], tags: ['目に優しい', 'デスク環境', 'テレワーク'] },
  { id: 3, name: '真鍮製 風水牛の置物 開運グッズ', price: 280, category: 'インテリア', emoji: '🐂', color: 'from-amber-100 to-yellow-300', url: 'https://a.aliexpress.com/_c3oiJoQl', images: ["data:image/jpeg;base64,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", "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCADIAMgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDg6KKKBigZpdtIDinb6QCbTSYqQNkZprEUgADFGQDSbqYTTAkPNNIxQrU4jIzQAzNFFFABS0lKKAADJxUyAKvNJGuOTTZGzxSGOYhulMYYpucUu7I5oEJRg08AEUuQB0pgR4NFOLCmUAFFFFABRRRQAClyKbRQApooooAcGwKaTmkooADSUUUxBTgaSikAuaKBRQMWlB5ptJmgCUvxgUw802igApRTaWgCRSBQzAio80tABRSUtACUUtJTAWikooAKKWikAlJTqKAG0U6imA2inUmKAEpaMUYpCCkpcUYpgJS0YoxQAtJSgUYpDG0UuKMUxCUooxS4pAJRS4ooGFFFFMAooooAKKKKQBRRRQAUUtJQAUUUtACUYopaAEooooAKKKKAClpKKAFxRiijNABiijNFABilpM0tACUlFFABRRRQAu1vQ0bW9DXRhIz1VaUxRn+Baz9ob+x8zm9p9DS7T6V0PlR/3BQIowf9WKPaB7F9znsH0NJg+ldJ5cXeMVGYIWP3BR7QXsX3Ofo5re+yQn+Cp4tJaX7tu2PUinzoPZW6nNYowfSuputEkskDzwrsIzuRg2B746VUMEP9wUvaISpX2Zg0Vu+RD/co+ywH+Gj2iH7F9zCord+yQY+7QLKA9qPaIPYswaUVutYwD0o+xQelHtEHsWYVFbgsYT2FT22jvdsy2tu0xX720cD6mjnQnSa6nOUldLLoskC7ri2eEerrx+dQ/YIfan7RAqTezMClre+xQD0o+xwego9oh+xZg0VuG1gHGBSCzgJ6CjnQexfcxKK3RZ247CijnQeyZLtY9BShX7irQVfSgqncH86wudRW2kdqDn0NWRHH6H86TCE4XLH0Xk0XEVee4NJz6GrSx+Y20bsjk4UnFSx26YAEZmlDYCDIBOcfexj8qpK5EppEtnpkhdWlWVcrvVdmCwyAAM9yTW5ZxOJES2jMjshEx3FWQ5z15H5VH4jmkhFtGJHGVPmNGoYgZHAB78Zpkd8r70W8kF5CQVUp5bFe4OepNVYwbbLl9FLGNskYUybQqgZXPGSx698Vyl3ZNbKs0Ss1u3T1T2re1TV7cwRIJ5JZjHlQTgkN6/lU9sIIIAlyV2soOG6VLY43RyKsp5BBFP3D2rSnsYxcvJpro3zZ8lhndj2PWmG5vdQd/wB0HjHHliPIXjr9aRsp3KAbPXFGM9CKeY2XtV6Czs5LISSXn2ebcQweMlT6cikU3YzdvqRT1QtGSgDYOMA8/lWlcXFhY2ohaGCaVs7pFOQQe6N6j0NNhuHg08z2loTbk480ryPqP61ViHPsQ22mSSqZLgGOIc4HVqmSYKrCMbIY84j37S3bI55xzxjnioY9TmacByG464qzpF2sd6s8mxgoYgbfmBPv+eKSfciV2W/7Tt3LR3BDrM5OBKzhs8c/3ce1ZeoaebbLRncqZ3e2P6/05qTUdVjnlCQoQw+VpgoUn2xz3/lTbLVJpLqOCaNJkhI2+Ypzgdye/wBDVkptbFFcEA4BB70vlgngCtPU7WP7bcTRIqQ7jhFzlcY5PbkmqAGeij061L0NoyTGGIAZKg0bVxjaKlC8cr+tIYwf4f1qblEYUA/dFFSbMfwj86KLjFLelWdPsnv5HVHWMIu53fooqn5OecfrToZnty4RmAcYbHQj0/WjQUm7aFuwji1GfyrRllAcqrSDaGwMk4/xrVOl6VApe6umZzz+6AUD6YFcppE5gikaIiNmJQt6A8VeDu5VWbOePxq3o7I59XqaxksbdPNWeO4hJ2r564bPuR296sq2oG2Sez0+1gDDIkXMjKPUVgXemyS7IUTbJMCQvUkL7dq0I/EVxZxrazMEMYCqY8c4/pQnYGi1bamkh+w3qM87cE+QAzccEYrFvbea8vmkigkQxttBcnJ9zk9a2x4jjGGES7x1baMmsPWbuzv7g3M1wyg4CxRjnI70KV2Fmi+TBHbztc4F2CqrvBLEgDj8eeayL7VpLmSPe4XauG9sGrttM+1jBcxPDKuGaf70YH8z9KwNXTzr2WVDhXJYe/NCs2GxdtpkmmEkpk8tTwFOM0+W6kmnAklYxIcICxG33wOprNgNz5SrwMDAJ7CrcESRDcWG7HcZoehaVzbE1lHGZl1CViB9zysFvbrVYhZYV34zjP0qqJlA+/j6LR9o/wCmjH8KixotCO8DRphfmVuKeb4rbhVbahGCAe1I0iSKVclh6Yqt9liJCx7sHruPSqS7ky3uVUuyJiQTxnGauW8spWM78ZxlehPv9AKbrD2m2GKztvKKIFZy2S57n86cZf8ARVAAVsBd46kDtVO1jJXuNjuD5gBmXk5ZwGBIz0rZtDYWaLcNLIjcsfLGUIPYd6qW10VXZ/ZyGJk2iVgd5b+9k1qyWem3PlLM3kpGBjyhw2fX3obAtqkOoqLqxeMyycPGxxv4xkAnrjvTbvSpGZmjtltweSMZ2D6DNU59NsIXX7Pf4cjIwSPzPT9Kg07W72JJI1dpoydv71s5oESnTb18/ZtzxZ+V5EAY/hQbSaFminKrKBlVYY3j2P8AQ1orrMQI82FQc/MysVwPb/69JrWpP9jDwJHK0fzNuTIZT0b271OjK5pIycqTyCMUVWGqQXcS5to4JGOA0fAJ9x/hRUNWN4yuiKW7MG1YIg1xnJZxuUD6dKgl1C4kgMbRwZBz5iLtI/KrU18XtI4FgUKmW443N6nPWqCSx7RuTLd+OlaIyerIbSRkD5jZlzncBV+GVo0wGZU64P8AF9aga4THJIFJJeJJIrF8bfaiSBWRba4uBBJFE2x5B8zbsnHpnris77PMgYNtkU+/OfUVt2T6ZebVuvNiByBLEeAT6iqWs6dcaWyliskD/wCrmTlWpxYnYzFmdT5Z35HXk08wbh8xUD3OagNzKJjICu7Oc7aj8xyeSauxnzGhGyxrhmVwPXg1o2cEF6URioTsawQ57ipobowN8uQD1PpUSj2LUu5o38clhcmEurgdCKiErMudwzVxrmxn04Qo7PcFg2dhyfqariAD2qfU0TbIt0hblh+VKc/3/wBKnEGRxS+Sw70XHZlNie7U3zWHG6rohY/xfoKa0DHrz+FO4NMzpGJcMTkjpmn2txiQxy42N+hqxJbY525qBoMfw4p3TRHK73EuUnhuQfNbGeCSaniv5kG1gHPZs1JfH/Q1Bw3A5zWSrkGmlzLUhvlZrQ3aJMDcB5I2+/sGMfStqxSwkbyo9pTHmIzHBPPTPc1yQnIqeK7PCufkznGcYNNx00DmRuak8bTskRYgtyT/AJ5quLySG1ljjfII2YHOfb9f0qo0jFAGlkkB6IvB/Fqt2f2MuVuUkjXjZ5WO2ck56motYZStLQoVkmccruULzjP9aK1zpippK3kbM0TzFUOOdnYkfUGik9WaQtYypbaZhwp/HP8AhUH2ecfeFaY9TM5P+6KTaM9c9+R/9emmDjcymtnz0P61G0DAdD+VbPl885YfT/69BgVuCuPwFPmJcDItpvs8nLMFPDYFbErW91pDIkpd1YFQW/pTTZR9GBI+lKunwJ8wHzdjtNJtPUORozVtRnlH/Kni0QnG1h+f+FaJj9W/8dNHkhjgMev9w0XK5UVBaRAD58fUZqaK0UEEOjeoKmrCRMp+V8fRDUo3D+Ns/Q0hkT7VTCLGo9xUQbuWi/KreXzncfbqKaWf/nofwJpDICwB5Mf5GlEidBsP/ATTy7gZ80nP+0aTdKf48j3NMd2AlTvt/wC+TThJFkliuPZTQolJ58v/AL6FSbXIzlAfrS0C7IGKdin/AHxTcKSMBD/wCrJiYn+D8xThBJ2K/iRRoPUz7i3icclQfdapPar2YfgtbjRMVwQmfwNR+U2MbEP5U1IlxOfa3PPH6VEYyD0ropYpMZ8tMfUVWe3dj9xB+Iq1IzdMx1d0IKsRitXTm+3h4Sq+YF3AjjNMazkPGwH8RU9rbS2khlS3jmypUq+MUm0xKLQ/MsNusckhWMHbgnOcc9Px60VG0c0v3oAg54JFFToWky5gn7u39KNrnPCn8qYMHq4/Kn4H99ak0uLtb+4v6U7ae6j9Ka23H+sWm7/9oflQFydc44QflQScYKVDvOeCKGJ6+ZRYLkg5PMefWlwuOIj+tR7hjluaeGTHJH5mlZhdC7R/cI/OlGMfcOfxpplTpuH5mmtJtH3h+Zoswuh5IwflI/Gj5MjGf8/hUHmvu+XB/GhZsH5iB/wKiwXJjs9H/CjCg9W/z+FM84di3/fQpfNcnA3kUBcd8nXJP4//AFqcCmMbjj8KZ5j9PmoWR8cq35U7Bck+QjBY/pS5Vejk/lUfmuDyp/Km+e+MhT+IosFyQ8/x/p/9emsAR98jNNErnoD/AN80/ezfwdP9miwrkJiz0lz9VzTSCB99f++f/r1YYt3Vh9KbtOCdp/GmIrnOeZFHtj/69Swuu37+73pXJPVF47kVF5hU/d/ICmK4sjYPLEemB1opjzknBhJJ+lFA7lpSD3Q/hSFznHyEVXG4H7pFALZ5FTYosKw/2KC3PBjFQox6bafnHGKBC8k9VpdueyimFvQUm80BYfhcc7aP3ef4BTN3saUn2pgKEQnhlH404w5xzn8ajBwfumguc/ecUBYlMHH3hkdKYYfXH51G7sT1alBGOSc0XCw4wEnt+dL9nP8ACT+dMBx/E1ODj1NIYeTL3elEEvqaUOM53Gl83nqaAEMEg65z7UeVKBnLD2p/mqTkk/nSiUHoT+dFxDNsoH3m/OkIlHc1JvOeXo3Z/j/OgZD+996d8+OtTZHsfxowuf8A69AiqwPcmosgHO3NXWjUmmGHjjNO/mK3kVRJj+CirJVvTnvxRQP5C9+tLiogzU7zD6UhjtufWjyznljTd7k8YFAaTPWgCTZj1pCg96Tc+KQs1AD9qkYIFLtHYAVB8570vzHvSGS7VzyKUug4C1Dtb+9SFDnJagCXIPYUFkHUCo9ox1NJwB0zQA8lD2FAERHI5qMsP7lAPPSmIk2RLSBYzTC2O1NMgHanYVycCMdqcFjPaqvmEnpSlj6U7C5iwY4s/exTvKi/vVSZyOaYZmxT5RcxoGOMHhqQwqe5qiJpDxgU4SyLzmlyBzlryNvIc/Sn+Q5HDN+NVRcNxmpRcNjq1DiNSHmKQHqaKjFwSeSaKmxVx2KXA9KKKQxQo60oA9aKKBAevWkIBoooGIFA6U4KPWiikAYWkIX1oopiFwo7007c0UUAKFWjYuaKKBgUXtimmFSM0UUXYrDfJXrmmmH/AGqKKfMwshrQccmo/LwaKKfMyeVChB3pSijvRRT5mHKhoXnrUhJxzmiihsOVCYHoaKKKVx2P/9k=", "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCADIAMgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDgKKKKYBRRRQAYooooAKKKKACkpaKAEpaKKAEopaKAEopaKAEopaSgAoopaAEooopgFFFFABRRRQAtFFFIAooooAKKKKACiiigBaSiigAooooAKKKKACiiigAooooAKSlooASilooASiiigAooooAWiiigAooooAKKWigBKKKKACilxRigBKKXFGKAEop1JQAlFLijFACUUYooAKKKWgBKKKKACiiigBKKWigDRGhan/z5yfpThoOpt0s3/HFejFeaMcVlzs6PZI88Xw5qh/5dsfVhUg8L6of+WKD6uK78HNPApc7D2UTgB4T1M/wxD/gdO/4RLUv+mP8A31Xf4puKOdh7KJwyeD75vvSwr+JNTJ4LuD966QfRa7UD1pwAo52P2cTjl8FD+K7P4JU8Xgy0H+snlb6YFdWVGKbjFLnY+SJgJ4S0xfvJI31c1KPCukn/AJYH/vs1tjBNHFPmYciMNvCWlHpE4+jmo28HaaennD/gddBmlBoux8q7HPjwdpnfzT/wOkbwhpmeBKP+B10Oaa7gUXYuSPYwf+ET0xRzG5+rmg+FdLx/qm/77NbZek3DvS5mVyR7GC3hLTT0Eo+j1FJ4OsiPklmU/UGuizS4o5mHJHscXc+Dp1BNvcK/swxWHe6bd2DYuIWUdmHIP416hxioriGOaIo6gg+tNTZDpLoeU0Vqa9YCxvTsGEboPSsutU7nO1Z2CiiimI9cK56U1eODT8gU1hk5rnO0rs5ikwehqdZBiormMyRnH3hyKpQXPY9qVyrXRqhs0owaqpLkVIJBTuTYlzS7iKhElHmZNO4ErSHFR+d60bgRzUJHNSFiXzRu4NPD1UYfPwalVvemBYDe9KDVcuB3pPN96LgWi1RyEYqHzfekaYbc5pXGOLe9RPKQeKjeZeuagecetA0WvP45NOF0MdazHnGetRG4A70irGubikNwKxpL5EGXcAD1NZN/rxKGO1ySeN/+FNJsUmorUZ4pu0nukijIOzJYj1rBqdbeeQ5WKRie4Umpl0q/cZW0l/75xW6slY4pXk72KVFW5dNvYQTJbSqB320U7omzPTlYOvWlHHWq9uQw4PNWR05rnO0Qn0FZF9EYbneB8r8/jWvVTUk3WrHuvzA0MaepWSQ4qVZPWs2O5+UHNP8AtQHekOxo+bjvSiWss3qj+IUw3wPCkn6CmFjX86mNMc5FZizXEn3In/EYpzRXhXLFYx780gsjQ88DmmG5HY1XitgqsWZ3HdhyB6mmrYI+WLM3PChjQRzRJXvFHVgKhN+mfvflV6DTrY8ADd6GraafCvRBQPmRitfEj5Q5/wCAmmG7nYYWGQj6V0ItYx/CKeIkH8IosHMjmN14elu340nlXzf8sgPxrqSiH+EU3y1HYUw5jlzZXrDkqP1pY9Inf78xH+6K6gIvoKjJCnFOwczMWPw/BwZFLn/aOavw6dbQgbYUz/uirW/0pC9ADdgHRQPpShaQtTgwx1pDDaCOaKQyKO9FArFeEbeQasq+RVFJMHGamWSgpot7hUFyhlgdM43KRTQ4JxmpRgigk519IuUcAzYU+gq1DoqH77O31NbbD5PmFMMqIu4kBR60h3KkWi2687AfrzVuOyiTACip43Mi5RWYDuozVeW9CAhVJfpg0yeYfL5cCbiPYAdTUEkPmxN5oBDDkelRCZFcNM+6RuhPQU25upbacJKMBsFfcHiobuQ5EFsyyfcaOSaNAQT14ONuO3HetkxRmzzuKSyNsVT698fhWDemJb65VSWUbUBVtpz16/nWq8yfYQklwqxmUKhZQ+QByRwRknvVJGbGXUW+eRbc4MZyTgDrwOD3/KpI/t8SnfFuC9RuGfwxTLiDyQ32aaaCcIAylkGRnjK+nJqT7Nd3yQBAjx4+fcmA59SR1qrWEm0KLuRio+zTAn1WkhvPORnVPlXr8w45x606bSlgRFuZgpkOFUHgt6Y7Cs+5QWeBIFi3gxso+71yPz65osVzl83gRsOhA9RzUsb+dnyypA6kkAVDZeW7yGaEcDJVzgg9xz/Oqd9bQS2rxE8bgFHZj7GkPmNYRM4JRkkA67HDfyqu5GcVznkRxEbFaFh0dCQRWq1409ikspHno5jdh/EMcH60XNLNMtMQO9QSSgdDVGS79Wqs9+mcdTQXY0GuMd+ajN02etUVN1M37qE49TxU66ddyY3SKv4UFEpufU0VUvNG1ARFreZGPoRiimlclySNBvlOTSebnhasvbtJ04HvTksccZqSrogRsDrk1Yik96lFkuPvU8WyKOBz60yWxu/ORniqk4UAhjkHsatmEjkGsXUZzDudjkDjFAkPmEdtG01tPNbOozmNsA/hUuiy3Oo3BW7MexGA81iFJzzj8awX1Eyhw6Ko6AKSc1Ol/Lbp/ozYjlHznGdpxj/Ggiauro7uWWwsbYrKY2GDkBck1wV3qguWjQBj5T4XJ/hz/wDWqzaeROjxz3ksxxhSRweP0wfzpL7SY4NPS4UyRSkE4PHI7D6g5o06mOxSs7meWW4b5JA2GZZBnPvXTCSW8sFl+zSCKAZEiDaY+mfryM5FcPazyLJmKRVJGCp6MK6PQtbns5THJl4T9+POcD29abVh2uht1qFu0qxwKs0oOTPOM5PqO/4GlOtanp6eXHf28sYOV2H/AB5qTxHohUHUbJvMt5PmyP4frWJFbwCMvNITz609BJXNCfW3uEZrp/tVw3CMWISL3UDHPuaZFrepKBH9pa5jxho5lDKR6Vny3tvBlbeME+p5qi93MzBt5XHTHGKa1G0kdlp+uCP7lvdQoybX2NvCHsyg/wAs1pxE6vIiQl5BGSxlljOQTjgZ/OuDhu5ACWZQT1ZZMZ/Ctmya5lRZIb2VN3QjtSaBRvsb+s6XHZ28cy+YwQjzNxzx3NZ2p2t+bgW8PleSAGDjpzVu11C9iZbW9lN7DMCPuZYeuam8j7FtiCyhDyBKQWH61JcW07MyodCY83M7P7LwK0bewt4B8kYz696n3cUwyY70GxKEA6AU4HFVvtAU1G9znvQBf3jGKKzvtPvRTCxqY5pw4NRb6XfSES5pe1RK4FOEgNMQPgiua1xMwyY+tdI6gjrWZe2iykhuVI6Uho4hn4wOTTRLMowpZfoa6xdKgXjYKH0W2cfdIPtTTE1c5q1u54pgzEun8QPcVprNJdoLOO5eUSH5E24w3qT9Kdd6I0Kl4juFJb6bbhEkmlK4YZwD09QfWhtEtaGbqWkyafceW7kgYySMVFa+a13H5RKncMGt57WW7bfcyNIo4Qtycds1Xa1WCX5Omaq+hKidHppWPR7lX1KNYz91Dt/rXKR6JNKSWPGa27VU2g7Rk+1X05XAFJaDUbHH3+lmzVSWyWOAKkh0y3FmZLgyec/3F2kAD1963L7T5LiUSAqSOBu7VNa2LDBncyMvTPahyYOJzkOnEsNtuSPVq27WFoEAK4xWsI1HamuBjpSKVkUWt1nlWQySoQMfI2M1ZgghiJKJ83948k0xjhuBxSiY5oKsSsW6Cq8hKclqZNdgd8Cs261ONAfmoGXJJiOe1VnulHVv1rEudVZshPzqhJcSSHljiqUGzN1UjavNXVFKxHcx/SisHNFaKCMXVkz1V15qJic46VY2nNJ5SnkjJrA6it5hp0RJbkVaWNQOAKX5R1oAjBIPA4pkoz1FT5HrUTkEUCKxTJGO9SeWAvvSsVUimtIAetAB5XBHWmi1TqwFMa6VetMN2T91Wb6CgLMlMCZ5FV5dORzkHFTRec7Aldvsam8pyw7CgWxSSz2DrU0abTVk25PehbUD7zE0wIWkUdcUwzZ+6pP0FXBbxjnaD9aUIByKBFIGZukZ/Gk8qZuuBV/ikNAyiLXcfnY/hUgsIvQ/nVk4pN4Heiwyhc6JbXCnLSIT3Vq4/XNGn0xw7OZYWOA/ofQ13/misvX2jl0m4V8fcJH1HSqi7Mmaujz6koorY4wooooA9cOKBTc5p2a5juHCkcDHNAakbrTsBXkjJ5RiDWdcXUkLbWOKvXhcR5j++eBUNtZgkSTYkk9T2+lSUmVoXuJx8kbEep4FWFsp35eQL7DmtBVxTgKYrlaGxiQ5K729W5qcxccU/IFKXAxRYlsjC4OadSOeOtIrAiqEPpKTdTGfvRYLklNJ/WofN96ZJcFVoAlbimtIFHXFVHujjrVaS5HUmgovvcAiqrzc8Gs6bUI4xkuB+NZN1rx5WIZ96LNiclHc6Ca9WFSXeuZ1fWGuwYYz8h6n1rPuLua4P7xyR6VXrSMO5hOrfRBRRRVmIUUUUAetds0bvWmhuKYTzXOdxJuGaUnmogeaUNzQMJBuYZxSrhaYxzSF6QE+4UbxUHmYFMeXA60CJ2f3qN5CV4PSqr3Az1qCW7AU4NMRdacYGT7UizjtWHJqABI3VXfV0T+KqEdFJc4HWqz36jjIrmJ9bLZCmqMmpSt0NOzJ5orc699RUfxAVRudWQKcNXLPdSv1c1GWJ6kmmokOquhuS60DwDVSfU3cEKT9azKM1XKiXVbHySvIcsxNMooqjJu4UUUUAFFFFABRRRQB6wDkUhoornO0jLc0gINFFAxJGCpVZ5h1BoopARNcBRyeapz36qpG4UUVQGZPqiqetZ82qs2QtFFXGKMZza2KL3EjHlqiLE9TRRV2MG2xKKKKYgooooAKKKKACjNFFABRRRQAUUUUAFFFFAH/2Q=="], tags: ['風水', '開運', 'コレクション'] },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function App() {
  const [maxPrice, setMaxPrice] = useState(10000);
  const [deck, setDeck] = useState(() => shuffle(SAMPLE_PRODUCTS).map((p, i) => ({ ...p, uid: `${p.id}-0-${i}` })));
  const [cycleCount, setCycleCount] = useState(0);
  const [liked, setLiked] = useState([]);
  const [view, setView] = useState('swipe');
  const [showModal, setShowModal] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('product-finder-seen');
    }
    return true;
  });
  const [swipeCount, setSwipeCount] = useState(0);
  const [selectedTag, setSelectedTag] = useState(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState(null);







  const closeModal = () => {
    setShowModal(false);
    localStorage.setItem('product-finder-seen', 'true');
  };

  const filteredDeck = useMemo(() => {
    return deck.filter(p => {
      const priceMatch = p.price <= maxPrice;
      const tagMatch = selectedTag ? p.tags.includes(selectedTag) : true;
      return priceMatch && tagMatch;
    });
  }, [deck, maxPrice, selectedTag]);

  const current = filteredDeck[0];

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);
  const scale = useTransform(x, [-200, 0, 200], [0.95, 1, 0.95]);
  const cardOpacity = useTransform(x, [-300, -200, -100, 0, 100, 200, 300], [0, 0.2, 0.6, 1, 0.6, 0.2, 0]);

  const showCelebration = (message, emoji, type) => {
    setCelebrationMessage({ message, emoji, type });
    setTimeout(() => setCelebrationMessage(null), 2500);
  };

  const advance = (direction) => {
    if (!current) return;

    const newSwipeCount = swipeCount + 1;
    setSwipeCount(newSwipeCount);
    setDeck(prev => {
      const remaining = prev.filter(p => p.uid !== current.uid);
      if (remaining.length <= 2) {
        const newCycle = cycleCount + 1;
        const refill = shuffle(SAMPLE_PRODUCTS).map((p, i) => ({ ...p, uid: `${p.id}-${newCycle}-${i}` }));
        setCycleCount(newCycle);
        return [...remaining, ...refill];
      }
      return remaining;
    });

    if (direction === 'right') {
      const newLiked = [{ ...current, likedAt: Date.now() }, ...liked];
      setLiked(newLiked);
      
      // お気に入り数による褒めメッセージ
      const likedMilestones = {
        5: { message: 'センスありますね！', emoji: '✨' },
        10: { message: 'コレクター気質ですね', emoji: '👑' },
        20: { message: '目利きですね！', emoji: '🎯' },
        50: { message: 'プロのバイヤー級！', emoji: '🏆' },
      };
      if (likedMilestones[newLiked.length]) {
        setTimeout(() => {
          showCelebration(likedMilestones[newLiked.length].message, likedMilestones[newLiked.length].emoji, 'liked');
        }, 600);
      }
    }

    // スワイプ数マイルストーン
    const swipeMilestones = {
      10: { message: '良いペース！', emoji: '🚀' },
      25: { message: 'すばらしい！', emoji: '⭐' },
      50: { message: '止まらない！', emoji: '🔥' },
      100: { message: 'もう100スワイプ！', emoji: '💎' },
      200: { message: '神の領域！', emoji: '⚡' },
      500: { message: '伝説の閲覧者！', emoji: '👑' },
    };
    if (swipeMilestones[newSwipeCount]) {
      setTimeout(() => {
        showCelebration(swipeMilestones[newSwipeCount].message, swipeMilestones[newSwipeCount].emoji, 'swipe');
      }, 600);
    }
  };

  const amazonUrl = current ? current.url : '#';
  const cartUrl = current ? `https://www.amazon.co.jp/gp/aws/cart/add.html?ASIN.1=${current.asin}&Quantity.1=1` : '#';
  const priceLabel = `¥${maxPrice.toLocaleString()}`;

  // 全タグを集計
  const allTags = useMemo(() => {
    const tagSet = new Set();
    SAMPLE_PRODUCTS.forEach(p => p.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet);
  }, []);

  // タグの出現数をカウント
  const tagCounts = useMemo(() => {
    const counts = {};
    filteredDeck.forEach(p => {
      p.tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  }, [filteredDeck]);

  // ----- CELEBRATION OVERLAY -----
  const CelebrationOverlay = () => (
    <AnimatePresence>
      {celebrationMessage && (
        <motion.div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
        >
          {/* 紙吹雪パーティクル */}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor: ['#fbbf24', '#3b82f6', '#a855f7', '#ec4899', '#10b981'][i % 5],
                left: '50%',
                top: '50%'
              }}
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: [0, 1, 0],
                x: (Math.random() - 0.5) * 300,
                y: (Math.random() - 0.5) * 200,
                rotate: Math.random() * 720,
              }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          ))}
          
          {/* メインメッセージ - 横長デザイン */}
          <motion.div
            className="bg-white/95 backdrop-blur rounded-2xl px-5 py-3 shadow-2xl border-2 border-blue-200 flex items-center gap-3"
            initial={{ scale: 0.8 }}
            animate={{ scale: [0.8, 1.05, 1] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <motion.div 
              className="text-3xl"
              animate={{ 
                rotate: [0, -10, 10, 0],
                scale: [1, 1.2, 1]
              }}
              transition={{ duration: 0.8 }}
            >
              {celebrationMessage.emoji}
            </motion.div>
            <div>
              <div className="text-base font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {celebrationMessage.message}
              </div>
              <div className="text-[10px] text-stone-500 font-semibold">
                {celebrationMessage.type === 'liked' 
                  ? `お気に入り ${liked.length}件` 
                  : `${swipeCount}スワイプ達成`}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ----- HELP MODAL -----
  const HelpModal = () => (
    <AnimatePresence>
      {showModal && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-3xl p-8 max-w-sm shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-black text-stone-800">Product Finder</h2>
              <p className="text-sm text-stone-500 mt-1">AliExpressのおすすめをスワイプで発見</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-lg">👉</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">スワイプで商品判定</p>
                  <p className="text-xs text-stone-600 mt-0.5">右スワイプ：お気に入り</p>
                  <p className="text-xs text-stone-600">左スワイプ：スキップ</p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-lg">💰</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">予算でフィルター</p>
                  <p className="text-xs text-stone-600 mt-0.5">予算タブで上限金額を設定</p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-lg">❤️</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">お気に入りを管理</p>
                  <p className="text-xs text-stone-600 mt-0.5">お気に入りタブで確認・購入</p>
                </div>
              </div>
            </div>

            <button
              onClick={closeModal}
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg transition-all active:scale-95 text-sm tracking-wide"
            >
              さっそく始める
            </button>
            
            <p className="text-xs text-stone-400 text-center mt-4">※ 最初の1回のみ表示されます</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ----- INSTALL MODAL -----
  const InstallModal = () => (
    <AnimatePresence>
      {showInstallModal && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowInstallModal(false)}
        >
          <motion.div
            className="bg-white rounded-3xl p-6 max-w-sm shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-black text-stone-800">ホーム画面に追加</h2>
              <p className="text-xs text-stone-500 mt-1">アプリのように使えるようになります</p>
            </div>

            <div className="space-y-4">
              {/* iOS手順 */}
              <div className="border border-stone-200 rounded-xl p-4">
                <h3 className="font-bold text-sm text-stone-800 mb-2 flex items-center gap-1.5">
                  <span className="text-lg">📱</span>
                  <span>iPhone (Safari)</span>
                </h3>
                <ol className="space-y-1.5 text-xs text-stone-600">
                  <li className="flex gap-2"><span className="font-bold text-blue-600">1.</span> 下部の「共有」ボタンをタップ</li>
                  <li className="flex gap-2"><span className="font-bold text-blue-600">2.</span> 「ホーム画面に追加」を選択</li>
                  <li className="flex gap-2"><span className="font-bold text-blue-600">3.</span> 右上の「追加」をタップ</li>
                </ol>
              </div>

              {/* Android手順 */}
              <div className="border border-stone-200 rounded-xl p-4">
                <h3 className="font-bold text-sm text-stone-800 mb-2 flex items-center gap-1.5">
                  <span className="text-lg">🤖</span>
                  <span>Android (Chrome)</span>
                </h3>
                <ol className="space-y-1.5 text-xs text-stone-600">
                  <li className="flex gap-2"><span className="font-bold text-blue-600">1.</span> 右上の「︙」メニューをタップ</li>
                  <li className="flex gap-2"><span className="font-bold text-blue-600">2.</span> 「ホーム画面に追加」を選択</li>
                  <li className="flex gap-2"><span className="font-bold text-blue-600">3.</span> 「追加」をタップ</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="mt-5 w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg transition-all active:scale-95 text-sm"
            >
              閉じる
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ----- SWIPE VIEW -----
  const SwipeView = () => {
    if (!current) {
      return (
        <div className="flex-1 flex items-center justify-center px-6 overflow-y-auto">
          <div className="text-center">
            <p className="text-stone-600 text-sm">商品がありません</p>
          </div>
        </div>
      );
    }

    // 3枚分のカードを描画用に取得
    const cards = filteredDeck.slice(0, 3);

    return (
      <div className="flex-1 flex flex-col items-center justify-start px-2 pt-2 pb-2 overflow-hidden relative">
        {/* カードスタックエリア */}
        <div className="w-full relative flex-1" style={{ minHeight: '400px' }}>
          {/* 後ろのカードから先に描画（zIndexで前面に配置） */}
          {cards.map((card, index) => {
            if (index === 0) {
              // 1枚目（最前面） - ドラッグ可能
              return (
                <SwipeCard
                  key="front-card"
                  card={card}
                  x={x}
                  rotate={rotate}
                  scale={scale}
                  cardOpacity={cardOpacity}
                  likeOpacity={likeOpacity}
                  nopeOpacity={nopeOpacity}
                  amazonUrl={amazonUrl}
                  onSwipeRight={() => advance('right')}
                  onSwipeLeft={() => advance('left')}
                  selectedTag={selectedTag}
                  setSelectedTag={setSelectedTag}
                />
              );
            } else {
              // 2,3枚目（背景） - 静的、スワイプで前面に上がる
              return (
                <BackgroundCard
                  key={`bg-card-${index}`}
                  card={card}
                  index={index}
                  x={x}
                />
              );
            }
          })}
        </div>

        {/* ハート/バツボタン */}
        <div className="flex gap-4 items-center w-full justify-center mb-0 mt-1 flex-shrink-0">
          <button
            onClick={() => {
              animate(x, -1000, {
                duration: 0.3,
                ease: 'easeOut',
                onComplete: () => {
                  advance('left');
                  requestAnimationFrame(() => x.set(0));
                }
              });
            }}
            className="w-10 h-10 rounded-full bg-white border-2 border-stone-300 shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
          >
            <X className="w-4 h-4 text-stone-600" strokeWidth={3} />
          </button>
          <button
            onClick={() => {
              animate(x, 1000, {
                duration: 0.3,
                ease: 'easeOut',
                onComplete: () => {
                  advance('right');
                  requestAnimationFrame(() => x.set(0));
                }
              });
            }}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
          >
            <Heart className="w-4 h-4 text-white" fill="white" />
          </button>
        </div>
      </div>
    );
  };

  // ----- BUDGET VIEW -----
  const BudgetView = () => (
    <div className="flex-1 flex flex-col overflow-y-auto px-6 py-4 h-full">
      <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-3xl p-6 text-white shadow-lg mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-xs font-semibold opacity-90 mb-0.5">予算上限</div>
            <motion.div 
              className="text-4xl font-black tracking-tight"
              key={maxPrice}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
            >
              {priceLabel}
            </motion.div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-90">該当商品</div>
            <div className="text-2xl font-bold">{filteredDeck.length}</div>
          </div>
        </div>
        
        <input
          type="range"
          min="0"
          max="10000"
          step="100"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
        />
        
        <div className="flex justify-between text-[10px] opacity-80 mt-3">
          <span>¥0</span>
          <span>¥10,000</span>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-xs font-bold text-stone-700 mb-2 flex items-center gap-1">
          <Sparkles className="w-4 h-4" /> 人気タグ
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {allTags.slice(0, 8).map(tag => (
            <motion.button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all ${
                selectedTag === tag 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {tag} {tagCounts[tag] && <span className="text-[10px] ml-1">({tagCounts[tag]})</span>}
            </motion.button>
          ))}
        </div>
        {selectedTag && (
          <button
            onClick={() => setSelectedTag(null)}
            className="text-xs text-blue-600 mt-2 font-semibold hover:underline"
          >
            フィルターをクリア
          </button>
        )}
      </div>
      
      <div className="mt-4 p-3 bg-stone-100 rounded-lg text-xs text-stone-600">
        <p className="mb-2 font-semibold">ご利用上の注意</p>
        <p>本サービスはAliExpressの商品情報を紹介しています。商品の最新情報・価格・在庫状況については、必ずAliExpressの商品ページでご確認ください。</p>
      </div>
    </div>
  );

  // ----- LIKED VIEW -----
  const LikedView = () => (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="px-6 py-4 border-b border-stone-200 bg-gradient-to-r from-blue-50 to-blue-100 flex-shrink-0 min-h-[68px]">
        <h3 className="text-sm font-bold text-stone-800">お気に入り</h3>
        <p className="text-xs text-stone-500 mt-0.5">{liked.length}件</p>
      </div>
      
      {liked.length > 0 && (
        <div className="mx-3 mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl">
          <div className="flex items-start gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-[11px] font-bold text-stone-800 mb-0.5">お気に入りはブラウザに保存されます</p>
              <p className="text-[10px] text-stone-600 leading-relaxed">
                ブラウザのキャッシュをクリアすると消えてしまう可能性があります。気に入った商品は<span className="font-bold text-orange-600">AliExpressのカートに追加</span>しておくと安心です。
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {liked.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Heart className="w-12 h-12 text-stone-300 mx-auto mb-2" fill="currentColor" />
              <p className="text-xs text-stone-500">商品をお気に入りに追加できます</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {liked.map((product, idx) => (
              <motion.a
                key={product.uid}
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.05, y: -4 }}
                className="bg-white border-2 border-blue-200 rounded-xl p-3 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className={`w-full h-20 rounded-lg bg-gradient-to-br ${product.color} flex items-center justify-center mb-2 shadow-sm overflow-hidden`}>
                  {product.images && product.images.length > 0 ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">{product.emoji}</span>
                  )}
                </div>
                <div className="text-[10px] font-bold text-stone-800 truncate">{product.name}</div>
                <div className="text-xs font-bold text-blue-600 mt-1">¥{product.price.toLocaleString()}</div>
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {product.tags && product.tags.slice(0, 2).map((tag, tidx) => (
                    <span key={tidx} className="text-[8px] px-1 py-0.5 bg-blue-50 text-blue-600 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ----- STATS VIEW -----
  const StatsView = () => {
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return (
      <div className="flex-1 flex flex-col overflow-y-auto px-6 py-4 h-full">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-lg mb-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs font-semibold opacity-90 mb-0.5">スワイプ数</div>
              <motion.div 
                className="text-4xl font-black"
                key={swipeCount}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
              >
                {swipeCount}
              </motion.div>
            </div>
            <TrendingUp className="w-12 h-12 opacity-30" />
          </div>
        </div>

        <h3 className="text-xs font-bold text-stone-700 mb-2">人気タグ TOP 5</h3>
        <div className="space-y-2 mb-6">
          {topTags.map(([tag, count], idx) => (
            <div key={tag} className="flex items-center gap-3">
              <div className="text-xs font-bold text-stone-500 w-4">{idx + 1}</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-stone-800 mb-0.5">{tag}</div>
                <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / Math.max(...Object.values(tagCounts))) * 100}%` }}
                    transition={{ delay: idx * 0.1 }}
                  />
                </div>
              </div>
              <div className="text-xs font-bold text-stone-600">{count}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
            <p className="text-[10px] text-stone-600 mb-1">総商品数</p>
            <p className="text-2xl font-black text-blue-600">{SAMPLE_PRODUCTS.length}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
            <p className="text-[10px] text-stone-600 mb-1">お気に入り数</p>
            <p className="text-2xl font-black text-purple-600">{liked.length}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-stone-50 to-stone-100 flex items-center justify-center sm:p-4">
      <HelpModal />
      <InstallModal />
      <CelebrationOverlay />
      <div className="w-full max-w-md h-full max-h-[100dvh] bg-white sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col" 
           style={{ fontFamily: "'Hiragino Sans', 'Yu Gothic', sans-serif" }}>
        
        <div className="px-4 pt-3 pb-2 flex flex-col border-b border-stone-100 flex-shrink-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
          {/* 装飾的な背景パターン */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200/30 to-purple-200/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-200/30 to-blue-200/30 rounded-full blur-2xl"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Product Finder
              </h1>
              <p className="text-[10px] text-stone-500 font-medium">AliExpressのおすすめをスワイプで発見</p>
            </div>
            <div className="flex gap-1.5 items-center">
              <button
                onClick={() => setShowInstallModal(true)}
                className="px-2.5 h-8 rounded-full bg-white/80 backdrop-blur hover:bg-white shadow-md flex items-center gap-1 transition-all active:scale-95 text-stone-600"
                title="ホーム画面に追加"
              >
                <Smartphone className="w-3 h-3" />
                <span className="text-[9px] font-bold whitespace-nowrap">追加</span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="w-8 h-8 rounded-full bg-white/80 backdrop-blur hover:bg-white shadow-md flex items-center justify-center transition-all active:scale-95"
                title="使い方を表示"
              >
                <span className="text-sm font-bold text-stone-600">?</span>
              </button>
            </div>
          </div>

          {/* 進捗バー */}
          <div className="mt-2 relative z-10">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-blue-500" />
                <span className="text-[9px] font-semibold text-stone-600">今日のスワイプ</span>
              </div>
              <span className="text-[9px] font-bold text-stone-700">
                <span className="text-blue-600">{swipeCount}</span> / 500
              </span>
            </div>
            <div className="w-full h-1 bg-white/60 rounded-full overflow-hidden backdrop-blur">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((swipeCount / 500) * 100, 100)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        <div className="px-4 pt-2 pb-1 flex-shrink-0">
          <div className="flex gap-1 bg-stone-100 rounded-full p-0.5">
            {[
              { id: 'swipe', icon: Layers },
              { id: 'budget', icon: Filter },
              { id: 'liked', icon: Heart, count: liked.length },
              { id: 'stats', icon: BarChart3 },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`flex-1 py-1.5 rounded-full flex items-center justify-center transition-all relative ${
                    view === tab.id ? 'bg-white shadow text-blue-600' : 'text-stone-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="absolute -top-1 -right-1 text-[9px] bg-red-500 text-white rounded-full px-1 min-w-[16px] text-center">{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {view === 'swipe' && <SwipeView />}
          {view === 'budget' && <BudgetView />}
          {view === 'liked' && <LikedView />}
          {view === 'stats' && <StatsView />}
        </div>
      </div>
    </div>
  );
}
