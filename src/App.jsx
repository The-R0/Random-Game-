import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Gamepad2, Clock, Trophy, RefreshCw, ExternalLink, X, Sparkles, Filter, Search, ChevronUp, Heart, Hash, Ban, Trash2, Check, Slash } from 'lucide-react';

// 🎮 游戏数据源 (直接包含在 App.jsx 中)
import { GAMES_DATA } from './games';
// 辅助函数：获取 Steam 封面图 (带自动降级)
const getSteamCover = (appId, gameName) => {
    if (!appId) {
        const encodedName = encodeURIComponent(gameName);
        return `https://placehold.co/600x350/1a1a1a/ffffff?text=${encodedName}`;
    }
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
};

// 📏 尺寸常量
const CARD_WIDTH = 300;
const CARD_HEIGHT = 160;
const GAP = 20;

// 🎨 游戏卡片组件 (包含屏蔽按钮)
const GameCard = ({ game, offsetFromCenter, onClick, onToggleWishlist, isWishlisted, onBanGame }) => {
    const maxDistance = CARD_WIDTH * 1.5;
    const distance = Math.min(Math.abs(offsetFromCenter), maxDistance);
    const ratio = 1 - distance / maxDistance;

    const scale = 1 + (Math.max(0, ratio) * 0.35);
    const opacity = 0.3 + (Math.max(0, ratio) * 0.7);
    const zIndex = Math.round(ratio * 100);
    const shadowIntensity = Math.max(0, ratio) * 40;

    return (
        <div
            className="absolute top-0 flex flex-col items-center justify-center transition-transform duration-75 select-none"
            style={{
                width: `${CARD_WIDTH}px`,
                height: `${CARD_HEIGHT}px`,
                left: `calc(50% - ${CARD_WIDTH / 2}px)`,
                transform: `translateX(${offsetFromCenter}px) scale(${scale})`,
                zIndex: zIndex,
                opacity: opacity,
                filter: `grayscale(${100 - (ratio * 100)}%)`,
            }}
        >
            <div
                className="w-full h-full bg-white overflow-hidden relative group cursor-pointer"
                onClick={() => onClick(game)}
                style={{
                    boxShadow: `0 ${shadowIntensity / 2}px ${shadowIntensity}px -5px rgba(0,0,0,0.3)`
                }}
            >
                <img
                    src={getSteamCover(game.steamAppId, game.name_en)}
                    alt={game.name_en}
                    className="w-full h-full object-cover"
                    draggable="false"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                {/* 悬浮操作按钮组 (调整了位置和样式) */}
                {ratio > 0.8 && (
                    <div className="absolute top-2 right-2 flex flex-col gap-2 z-20">
                        {/* 收藏按钮 */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleWishlist(game.id);
                            }}
                            className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors backdrop-blur-sm shadow-md"
                            title="Add to Wishlist"
                        >
                            <Heart
                                className={`w-4 h-4 transition-all ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-white'}`}
                            />
                        </button>
                        
                        {/* 屏蔽按钮 - 放在心愿单下方，带斜杠禁止图标 */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onBanGame(game.id);
                            }}
                            className="p-2 rounded-full bg-black/50 hover:bg-red-600/80 transition-colors backdrop-blur-sm shadow-md group/ban"
                            title="Ban this game"
                        >
                            <Ban className="w-4 h-4 text-white/70 group-hover/ban:text-white" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const App = () => {
    const [showIntro, setShowIntro] = useState(true);

    if (!GAMES_DATA || GAMES_DATA.length === 0) {
        return <div className="p-10 text-black text-2xl">❌ 错误：无法读取游戏数据。</div>;
    }

    const [status, setStatus] = useState('idle');
    const [scrollPos, setScrollPos] = useState(0);
    const [resultGame, setResultGame] = useState(null);
    
    // 🔍 筛选状态
    const [selectedGenres, setSelectedGenres] = useState([]); // 选中的类型 (Include)
    const [excludedGenres, setExcludedGenres] = useState([]); // 屏蔽的类型 (Exclude)
    const [bannedGames, setBannedGames] = useState([]);       // 屏蔽的具体游戏 ID
    
    const [genreSearchTerm, setGenreSearchTerm] = useState('');
    const [gameSearchTerm, setGameSearchTerm] = useState(''); 

    // ❤️ 心愿单状态
    const [wishlist, setWishlist] = useState([]);
    const [wishlistMode, setWishlistMode] = useState(false); 

    // 👇 智能提取所有标签（并拆分）
    const allGenres = useMemo(() => {
        const genresSet = new Set();
        GAMES_DATA.forEach(game => {
            if (!game.genre) return;
            const splitGenres = game.genre.split('/');
            splitGenres.forEach(g => genresSet.add(g.trim()));
        });
        return Array.from(genresSet).sort();
    }, []);

    // 👇 核心过滤逻辑 (包含屏蔽功能)
    const filteredGames = useMemo(() => {
        let games = GAMES_DATA;

        // 0. 首先剔除被单独屏蔽的游戏
        if (bannedGames.length > 0) {
            games = games.filter(game => !bannedGames.includes(game.id));
        }

        // 1. 心愿单模式
        if (wishlistMode) {
            games = games.filter(game => wishlist.includes(game.id));
        }

        // 2. 类型筛选 (Include & Exclude)
        games = games.filter(game => {
            if (!game.genre) return false;
            const gameGenres = game.genre.split('/').map(g => g.trim());

            // A. 类型屏蔽逻辑 (Exclude)
            if (excludedGenres.length > 0) {
                const isExcluded = excludedGenres.some(excluded => gameGenres.includes(excluded));
                if (isExcluded) return false;
            }

            // B. 类型选中逻辑 (Include)
            if (selectedGenres.length > 0) {
                return selectedGenres.some(selected => gameGenres.includes(selected));
            }

            return true;
        });

        // 3. 游戏名搜索
        if (gameSearchTerm) {
            const term = gameSearchTerm.toLowerCase();
            games = games.filter(game => {
                const zh = game.name_zh.toLowerCase();
                const en = game.name_en.toLowerCase();
                return zh.includes(term) || en.includes(term);
            });
        }
        
        return games;
    }, [selectedGenres, excludedGenres, bannedGames, wishlist, wishlistMode, gameSearchTerm]);

    // 重置状态逻辑
    const prevFilteredLength = useRef(GAMES_DATA.length);
    const [activeGame, setActiveGame] = useState(filteredGames.length > 0 ? filteredGames[0] : null);

    useEffect(() => {
        if (filteredGames.length !== prevFilteredLength.current || (filteredGames.length > 0 && filteredGames[0] !== activeGame)) {
             prevFilteredLength.current = filteredGames.length;
             setScrollPos(0);
             setActiveGame(filteredGames.length > 0 ? filteredGames[0] : null);
        }
    }, [filteredGames]);


    // 可见标签
    const visibleGenres = useMemo(() => {
        if (!genreSearchTerm) return allGenres;
        return allGenres.filter(g => g.toLowerCase().includes(genreSearchTerm.toLowerCase()));
    }, [allGenres, genreSearchTerm]);

    const containerRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startScrollPos = useRef(0);
    const lastDragTime = useRef(0);
    const velocity = useRef(0);
    const animationFrameId = useRef(null);

    const totalContentWidth = filteredGames.length * (CARD_WIDTH + GAP);

    // 👇 筛选逻辑处理
    const toggleGenre = (genre) => {
        if (status === 'rolling') return;

        if (selectedGenres.includes(genre)) {
            // 当前是选中 -> 变为屏蔽
            setSelectedGenres(prev => prev.filter(g => g !== genre));
            setExcludedGenres(prev => [...prev, genre]);
        } else if (excludedGenres.includes(genre)) {
            // 当前是屏蔽 -> 变为重置(未选)
            setExcludedGenres(prev => prev.filter(g => g !== genre));
        } else {
            // 当前是未选 -> 变为选中
            setSelectedGenres(prev => [...prev, genre]);
        }
    };

    const toggleWishlist = (gameId) => {
        setWishlist(prev => {
            if (prev.includes(gameId)) {
                return prev.filter(id => id !== gameId);
            } else {
                return [...prev, gameId];
            }
        });
    };

    const banGame = (gameId) => {
        if (window.confirm("确定要暂时屏蔽这款游戏吗？它将不会出现在随机结果中，直到重置。")) {
            setBannedGames(prev => [...prev, gameId]);
        }
    };

    const resetFilter = () => {
        if (status === 'rolling') return;
        setSelectedGenres([]);
        setExcludedGenres([]);
        setBannedGames([]); 
        setGenreSearchTerm('');
        setGameSearchTerm('');
        setWishlistMode(false);
    };

    // 📍 核心逻辑
    const updateActiveGame = useCallback((currentPos) => {
        if (filteredGames.length === 0) {
            setActiveGame(null);
            return;
        }
        const itemWidth = CARD_WIDTH + GAP;
        let index = Math.round(-currentPos / itemWidth);

        // 处理循环索引
        index = index % filteredGames.length;
        if (index < 0) index += filteredGames.length;

        if (filteredGames[index]) {
            setActiveGame(filteredGames[index]);
        }
    }, [filteredGames]);

    const handleMouseDown = (e) => {
        if (status === 'rolling') return;
        isDragging.current = true;
        startX.current = e.pageX || e.touches?.[0].pageX;
        startScrollPos.current = scrollPos;
        velocity.current = 0;
        lastDragTime.current = Date.now();
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        const x = e.pageX || e.touches?.[0].pageX;
        const delta = x - startX.current;
        const newPos = startScrollPos.current + delta;

        const now = Date.now();
        const dt = now - lastDragTime.current;
        if (dt > 0) {
            velocity.current = (delta - (scrollPos - startScrollPos.current)) / dt;
        }
        lastDragTime.current = now;

        setScrollPos(newPos);
        updateActiveGame(newPos);
    };

    const handleMouseUp = () => {
        if (!isDragging.current) return;
        isDragging.current = false;

        const applyInertia = () => {
            velocity.current *= 0.92;
            if (Math.abs(velocity.current) < 0.1) {
                snapToNearest();
                return;
            }
            setScrollPos(prev => {
                const next = prev + velocity.current * 15;
                updateActiveGame(next);
                return next;
            });
            animationFrameId.current = requestAnimationFrame(applyInertia);
        };
        applyInertia();
    };

    const snapToNearest = () => {
        const itemWidth = CARD_WIDTH + GAP;
        setScrollPos(prev => {
            const targetIndex = Math.round(prev / itemWidth);
            const targetPos = targetIndex * itemWidth;

            const animateSnap = () => {
                setScrollPos(current => {
                    const diff = targetPos - current;
                    if (Math.abs(diff) < 1) {
                        updateActiveGame(targetPos);
                        return targetPos;
                    }
                    const next = current + diff * 0.2;
                    updateActiveGame(next);
                    animationFrameId.current = requestAnimationFrame(animateSnap);
                    return next;
                });
            };
            animateSnap();
            return prev;
        });
    };

    const startRoulette = () => {
        if (status === 'rolling' || filteredGames.length === 0) return;
        setStatus('rolling');

        const winnerIndex = Math.floor(Math.random() * filteredGames.length);
        const winnerGame = filteredGames[winnerIndex];

        const itemWidth = CARD_WIDTH + GAP;

        const currentVirtualIndex = Math.round(-scrollPos / itemWidth);
        const minSpins = 40;
        const baseTargetIndex = currentVirtualIndex + minSpins;
        const length = filteredGames.length;
        const currentMod = baseTargetIndex % length;
        const safeCurrentMod = currentMod < 0 ? currentMod + length : currentMod;
        const remainder = (winnerIndex - safeCurrentMod + length) % length;
        const targetVirtualIndex = baseTargetIndex + remainder;
        const targetPos = -(targetVirtualIndex * itemWidth);

        const duration = 5000;
        const startTime = Date.now();
        const startPos = scrollPos;

        const animateRoll = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
            const currentP = startPos + (targetPos - startPos) * ease;

            setScrollPos(currentP);
            updateActiveGame(currentP);

            if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(animateRoll);
            } else {
                setScrollPos(targetPos);
                updateActiveGame(targetPos);
                setTimeout(() => {
                    setStatus('result');
                    setResultGame(winnerGame);
                }, 300);
            }
        };

        animationFrameId.current = requestAnimationFrame(animateRoll);
    };

    const reset = () => {
        setStatus('idle');
        setResultGame(null);
    };

    const renderCards = () => {
        if (filteredGames.length === 0) {
            return <div className="text-slate-400 text-lg">No games found...</div>;
        }

        const visibleCards = [];
        const itemWidth = CARD_WIDTH + GAP;

        filteredGames.forEach((game, index) => {
            const basePos = index * itemWidth;
            let realPos = basePos + scrollPos;
            const halfTotalWidth = totalContentWidth / 2;

            if (totalContentWidth > window.innerWidth) {
                while (realPos > halfTotalWidth) realPos -= totalContentWidth;
                while (realPos < -halfTotalWidth) realPos += totalContentWidth;
            }

            if (Math.abs(realPos) < window.innerWidth / 2 + CARD_WIDTH) {
                visibleCards.push(
                    <GameCard
                        key={game.id}
                        game={game}
                        offsetFromCenter={realPos}
                        isWishlisted={wishlist.includes(game.id)}
                        onToggleWishlist={toggleWishlist}
                        onBanGame={banGame}
                        onClick={() => {
                            if (Math.abs(realPos) < 5) {
                                setStatus('result');
                                setResultGame(game);
                            }
                        }}
                    />
                );
            }
        });

        return visibleCards;
    };

    return (
        <div className="relative min-h-screen bg-white text-slate-900 font-sans overflow-hidden flex flex-col select-none">
            
            {/* 开幕引导页 */}
            <div 
                onClick={() => setShowIntro(false)}
                className={`fixed inset-0 z-50 bg-white flex flex-col items-center justify-center cursor-pointer transition-transform duration-1000 ease-in-out ${showIntro ? 'translate-y-0' : '-translate-y-full'}`}
            >
                <div className="text-center space-y-4 animate-pulse">
                    <p className="text-4xl md:text-6xl font-black text-blue-600 italic tracking-tighter">
                        You know you want to start
                    </p>
                    <p className="text-4xl md:text-6xl font-black text-blue-600 italic tracking-tighter">
                        You must start now
                    </p>
                </div>
                <div className="absolute bottom-10 animate-bounce text-slate-400">
                    <ChevronUp className="w-8 h-8" />
                </div>
            </div>

            {/* 背景装饰 */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[50%] bg-blue-50 rounded-full blur-[120px] opacity-60"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[50%] bg-purple-50 rounded-full blur-[120px] opacity-60"></div>
                <div className="absolute inset-0 opacity-[0.03] bg-[size:20px_20px] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)]"></div>
            </div>

            {/* 1. 顶部标题 */}
            <header className="relative z-10 py-6 text-center">
                <div className="inline-flex items-center gap-3 border-b-2 border-black pb-3 px-6">
                    <Gamepad2 className="w-6 h-6 text-black" />
                    <h1 className="text-2xl md:text-3xl font-black tracking-[0.2em] uppercase text-black">
                        Decisive Gamer
                    </h1>
                </div>
            </header>
            
            {/* 👇 0. 中央大搜索框 */}
            <div className="relative z-30 flex justify-center pb-4">
                <div className="relative group w-64 md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search game..." 
                        value={gameSearchTerm}
                        onChange={(e) => setGameSearchTerm(e.target.value)}
                        className="w-full bg-white/80 backdrop-blur-sm border border-slate-300 rounded-full pl-10 pr-4 py-2 text-sm font-medium focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400 shadow-sm"
                    />
                </div>
            </div>

            {/* 2. 游戏滚动区域 */}
            <div
                className="relative z-10 w-full h-[260px] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
                onMouseMove={handleMouseMove}
                onTouchMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchEnd={handleMouseUp}
                onMouseLeave={handleMouseUp}
                ref={containerRef}
            >
                {/* 中央选中线 */}
                <div className="absolute left-1/2 top-10 bottom-10 w-[1px] bg-black/20 z-0 pointer-events-none"></div>
                <div className="absolute top-[20px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-black z-20"></div>

                {/* 卡片容器 */}
                <div className="relative w-full h-full flex items-center justify-center">
                    {renderCards()}
                </div>
            </div>

            {/* 3. 中部信息区 */}
            <div className="relative z-10 flex-grow flex flex-col items-center justify-start pt-6 space-y-2 h-32">
                {activeGame ? (
                    <div className="text-center px-4 transition-all duration-300 animate-fade-in">
                        <h2 className="text-3xl md:text-5xl font-black text-black tracking-tighter leading-tight">
                            {activeGame.name_zh.replace(/[《》]/g, '')}
                        </h2>
                        <p className="text-slate-400 text-sm md:text-base font-medium mt-2 uppercase tracking-widest">
                            {activeGame.name_en}
                        </p>
                        <div className="flex gap-2 justify-center mt-4">
                            {activeGame.genre && activeGame.genre.split('/').map((g, i) => (
                                <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-200">
                                    {g.trim()}
                                </span>
                            ))}
                            <span className="flex items-center gap-1 text-xs text-slate-500 font-bold ml-2">
                                <Clock className="w-3 h-3" /> {activeGame.playtime ? `${activeGame.playtime}H` : '未知'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="text-slate-400 font-bold">
                        {filteredGames.length === 0 ? "No Games Found..." : "Drag to Select"}
                    </div>
                )}
            </div>

            {/* 4. 底部按钮区 */}
            <div className="relative z-20 pb-16 md:pb-24 flex justify-center">
                {status === 'idle' ? (
                    <button
                        onClick={startRoulette}
                        disabled={filteredGames.length === 0}
                        className={`group relative px-12 py-5 font-bold text-lg tracking-[0.15em] transition-all overflow-hidden rounded-full shadow-xl ${filteredGames.length === 0
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-black text-white hover:scale-105 active:scale-95 hover:shadow-2xl hover:shadow-purple-500/20'
                            }`}
                    >
                        {filteredGames.length > 0 && (
                            <>
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
                                <div className="absolute inset-0 w-full h-full bg-black opacity-100 group-hover:opacity-90 transition-opacity duration-300 rounded-full"></div>
                            </>
                        )}

                        <span className="relative flex items-center gap-3 z-10 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-200 group-hover:to-pink-200 transition-all">
                            <Sparkles className={`w-5 h-5 ${filteredGames.length > 0 ? 'text-yellow-400 group-hover:text-white animate-pulse' : 'text-slate-500'}`} />
                            {filteredGames.length > 0 ? 'RANDOMIZE' : 'NO GAMES'}
                        </span>

                        {filteredGames.length > 0 && (
                            <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[30deg] group-hover:animate-shine" />
                        )}
                    </button>
                ) : status === 'rolling' ? (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-black rounded-full animate-spin"></div>
                        <span className="text-xs font-bold text-slate-300 tracking-widest mt-2">SEARCHING FATE...</span>
                    </div>
                ) : (
                    <button
                        onClick={reset}
                        className="px-10 py-4 bg-white hover:bg-slate-50 text-black font-bold text-lg tracking-widest border-2 border-black transition-colors rounded-full"
                    >
                        BACK TO LIST
                    </button>
                )}
            </div>

            {/* 5. 左下角筛选面板 (支持三态切换：选中/屏蔽/重置) */}
            <div className="fixed bottom-6 left-6 z-40 w-48 bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl shadow-2xl p-4 flex flex-col gap-3 transition-all hover:bg-white animate-fade-in max-h-[60vh]">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-black" />
                        <span className="font-black text-xs tracking-widest text-black">TAGS</span>
                    </div>
                    {(selectedGenres.length > 0 || excludedGenres.length > 0 || wishlistMode || bannedGames.length > 0) && (
                        <button 
                            onClick={resetFilter}
                            className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase"
                        >
                            Reset All
                        </button>
                    )}
                </div>
                
                {/* 💖 心愿单模式开关 */}
                <button 
                    onClick={() => {
                        if (status !== 'rolling') setWishlistMode(!wishlistMode);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                        wishlistMode 
                        ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' 
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <Heart className={`w-3 h-3 ${wishlistMode ? 'fill-red-600' : ''}`} />
                        <span className="text-[10px] font-bold">WISHLIST</span>
                    </div>
                    <span className="text-[10px] font-mono bg-white/50 px-1.5 rounded">
                        {wishlist.length}
                    </span>
                </button>

                 {/* 🚫 已屏蔽游戏数量提示 */}
                 {bannedGames.length > 0 && (
                     <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[10px]">
                         <div className="flex items-center gap-2">
                             <Ban className="w-3 h-3" />
                             <span>Banned Games</span>
                         </div>
                         <span className="font-mono">{bannedGames.length}</span>
                     </div>
                 )}

                {/* 标签列表 (单列垂直滚动) */}
                <div className="flex flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
                    {visibleGenres.length > 0 ? visibleGenres.map(genre => {
                        const isSelected = selectedGenres.includes(genre);
                        const isExcluded = excludedGenres.includes(genre);
                        
                        return (
                            <button
                                key={genre}
                                onClick={() => toggleGenre(genre)}
                                className={`w-full text-left px-3 py-1.5 text-[10px] font-bold rounded border transition-all flex justify-between items-center ${
                                    isSelected
                                        ? 'bg-black text-white border-black shadow-sm'
                                        : isExcluded 
                                            ? 'bg-red-50 text-red-600 border-red-200 decoration-slice line-through'
                                            : 'bg-white text-slate-500 border-transparent hover:bg-slate-50 hover:text-black'
                                }`}
                            >
                                <span>{genre}</span>
                                {isSelected && <Check className="w-3 h-3" />}
                                {isExcluded && <Ban className="w-3 h-3" />}
                            </button>
                        );
                    }) : (
                        <div className="w-full text-center py-4 text-xs text-slate-400 italic">Empty...</div>
                    )}
                </div>
                
                {/* 底部状态 */}
                <div className="pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 text-center">
                    {filteredGames.length} RESULTS
                </div>
            </div>

            {/* 6. 结果详情 (保持不变) */}
            {status === 'result' && resultGame && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl p-6 animate-fade-in">
                    <div className="w-full max-w-3xl bg-white shadow-2xl border border-slate-100 rounded-3xl overflow-hidden transform transition-all hover:scale-[1.01] duration-500">
                        <button
                            onClick={reset}
                            className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-black transition-colors z-20"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="flex flex-col md:flex-row">
                            <div className="w-full md:w-1/2 aspect-video md:aspect-auto relative group overflow-hidden">
                                <img
                                    src={getSteamCover(resultGame.steamAppId, resultGame.name_en)}
                                    alt={resultGame.name_en}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/10"></div>
                                <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 text-xs font-bold tracking-wider uppercase">
                                    Winner Selected
                                </div>
                            </div>

                            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center text-center md:text-left">
                                <h2 className="text-3xl md:text-4xl font-black text-black leading-none mb-2">
                                    {resultGame.name_zh.replace(/[《》]/g, '')}
                                </h2>
                                <p className="text-slate-400 font-mono text-sm uppercase tracking-wider mb-6">
                                    {resultGame.name_en}
                                </p>

                                <div className="w-12 h-1 bg-black md:mx-0 mx-auto mb-6"></div>

                                <p className="text-slate-600 text-lg italic font-serif mb-8 leading-relaxed">
                                    {resultGame.desc}
                                </p>

                                <div className="flex flex-col gap-3">
                                    <a 
                                        href={`https://store.steampowered.com/app/${resultGame.steamAppId}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full py-4 bg-black text-white font-bold text-center rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                                    >
                                        View on Steam <ExternalLink className="w-4 h-4" />
                            </a>
                                    <button 
                                        onClick={startRoulette}
                                        className="w-full py-4 bg-slate-100 text-slate-600 font-bold text-center rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        Try Again <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e2e8f0;
          border-radius: 20px;
        }
        @keyframes shine {
            0% { left: -100%; }
            100% { left: 200%; }
        }
        .animate-shine {
            animation: shine 2s infinite linear;
        }
        @keyframes fade-in {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
            animation: fade-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>
        </div>
    );
};

export default App;