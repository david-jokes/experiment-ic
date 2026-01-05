// 1. DUMMY DATA GENERATOR (fallback)
const fundNames = [
    "Global Technology Equity", "Conservative Balanced", "Emerging Markets Growth", 
    "S&P 500 Index Fund", "European Dividend Aristocrats", "Renewable Energy ESG", 
    "Global Real Estate REIT", "US Small Cap Alpha", "Core Bond Opportunity", 
    "Digital Economy Fund", "Healthcare Innovation", "Nordic Sustainability", 
    "Global Infrastructure Fund", "Strategic Income", "Future Mobility Portfolio", 
    "Blue Chip Select", "Corporate Debt Fund", "Asia Pacific Ex-Japan", 
    "Commodity Supercycle", "Volatility Managed Equity"
];

function generateData() {
    return fundNames.map((name, index) => {
        const ret5 = parseFloat((Math.random() * 15 - 2).toFixed(2));
        const ret10 = index % 4 === 0 ? null : parseFloat((Math.random() * 12 - 1).toFixed(2));
        const retAll = parseFloat((Math.random() * 10 + 2).toFixed(2));
        const ter = parseFloat((Math.random() * 1.5 + 0.1).toFixed(2));
        
        // Sparkline data (5 points - jeden za každý rok za posledních 5 let)
        let current = 100;
        const sparkPoints = Array.from({length: 5}, () => {
            current += (Math.random() - 0.3) * 15; // Větší variabilita pro roční hodnoty
            return parseFloat(current.toFixed(2));
        });

        // Náhodný poskytovatel
        const provider = providers[Math.floor(Math.random() * providers.length)];

        return {
            id: index + 1,
            name: name,
            provider: provider,
            ret5: ret5,
            ret10: ret10,
            retAll: retAll,
            maxPlus: parseFloat((Math.random() * 40 + 10).toFixed(1)),
            maxMinus: parseFloat((Math.random() * -30 - 5).toFixed(1)),
            aum: parseFloat((Math.random() * 5000 + 100).toFixed(0)),
            ter: ter,
            sparkline: sparkPoints
        };
    });
}

const providers = [
    { color: '#2870ED', text: 'ČS' },
    { color: '#991B1F', text: 'VG' },
    { color: '#000000', text: 'BR' }
];

// Mapování názvu poskytovatele na objekt s barvou
function getProviderObject(providerName) {
    const provider = providers.find(p => p.text === providerName);
    return provider || providers[0]; // Fallback na první poskytovatele
}

// Načtení dat z JSON souboru
async function loadFundsData() {
    try {
        const response = await fetch('./funds-data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('JSON soubor neobsahuje validní data');
        }
        
        // Převedení provider stringu na objekt s barvou
        return data.map(fund => ({
            ...fund,
            provider: getProviderObject(fund.provider),
            // Zajištění, že sparkline jsou čísla, ne stringy
            sparkline: fund.sparkline ? fund.sparkline.map(p => parseFloat(p)) : []
        }));
    } catch (error) {
        console.warn('Nepodařilo se načíst data z JSON, používám generovaná data:', error.message);
        // Fallback na generovaná data
        return generateData();
    }
}

let fundsData = [];
let currentSort = { column: 3, desc: true }; // Default 10y desc
let selectedPerformance = 'ret10'; // Default: 10y p.a.
let favoriteFunds = new Set(); // Set pro ukládání ID oblíbených fondů
let showFavoritesOnly = false; // Flag pro filtrování oblíbených

// 2. RENDERING
function formatAUM(milli) {
    if (milli >= 1000) return (milli / 1000).toFixed(1) + 'B';
    return milli + 'M';
}

function createSparkline(points, width = 100, height = 30) {
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1; // Zabránit dělení nulou
    
    const coords = points.map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((p - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    // Barva podle vývoje grafu: pokud poslední hodnota > první hodnota = zelená, jinak červená
    const firstValue = points[0];
    const lastValue = points[points.length - 1];
    const isPositive = lastValue > firstValue;
    const color = isPositive ? '#24a148' : '#ff3b30';
    
    return `<svg class="sparkline-svg" width="${width}" height="${height}"><polyline points="${coords}" style="stroke: ${color}; fill: none; stroke-width: 1.5;"/></svg>`;
}

// Funkce pro určení barvy podle hodnoty ceny nákladů
function getCostPriceColor(value) {
    if (value === "WARNING" || value === "—") {
        return "";
    }
    
    const numValue = parseFloat(value);
    
    if (numValue < 10) {
        return "#1e7e34"; // Tmavě zelená
    } else if (numValue < 20) {
        return "#28a745"; // Světle zelená
    } else if (numValue < 35) {
        return "#ff8c00"; // Oranžová
    } else if (numValue < 50) {
        return "#dc3545"; // Červená
    } else {
        return "#8b0000"; // Tmavě červená
    }
}

function calculateCostPrice(fund) {
    let baseRet = null;
    
    if (selectedPerformance === 'ret5') {
        baseRet = fund.ret5;
    } else if (selectedPerformance === 'ret10') {
        baseRet = fund.ret10 !== null ? fund.ret10 : fund.ret5;
    } else if (selectedPerformance === 'retAll') {
        baseRet = fund.retAll;
    }
    
    // Pokud je výkonnost null, vrať "—"
    if (baseRet === null) {
        return "—";
    }
    
    // Pokud je výkonnost záporná, rovnou zobraz varování (bez počítání vzorce)
    if (baseRet < 0) {
        return "WARNING";
    }
    
    // Výkonnost je čistá (net), hrubá výkonnost = čistá + TER
    const grossRet = baseRet + fund.ter;
    
    // Pokud je hrubá výkonnost <= 0, zobraz varování (poplatek je větší než hrubá výkonnost)
    if (grossRet <= 0) {
        return "WARNING";
    }
    
    // Vypočítat podíl TER z hrubé výkonnosti: TER / (TER + čistá výkonnost) × 100
    const costPrice = (fund.ter / grossRet) * 100;
    
    // Pokud je výsledek větší než 100%, vrať varování
    if (costPrice > 100) {
        return "WARNING";
    }
    
    return costPrice.toFixed(1);
}

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    data.forEach((f, idx) => {
        const costPrice = calculateCostPrice(f);
        const tr = document.createElement('tr');
        
        // Zkontrolovat, jestli je to testovací fond (SP500 Market Cap Weighted od VG)
        const isTestFund = f.name.includes('SP500 Market Cap Weighted') && f.provider.text === 'VG';
        
        if (isTestFund) {
            tr.className = 'expandable';
            tr.setAttribute('data-expanded', 'false');
        }
        
        const isFavorite = favoriteFunds.has(f.id);
        // Vytvořit odkaz pro fond "Top Stocks"
        const fundNameCell = f.name === 'Top Stocks' 
            ? `<a href="topstocks.html" style="color: var(--text-main); text-decoration: none; font-weight: 500; transition: color 0.2s ease;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-main)'">${f.name}</a>`
            : f.name;
        
        tr.innerHTML = `
            <td class="favorite-cell"><span class="favorite-star" data-fund-id="${f.id}">${isFavorite ? '&#9733;' : '&#9734;'}</span></td>
            <td>${idx + 1}</td>
            <td>${fundNameCell}</td>
            <td><div class="provider-logo" style="background-color: ${f.provider.color}; color: #ffffff;">${f.provider.text}</div></td>
            <td class="${f.ret5 !== null ? (f.ret5 >= 0 ? 'val-pos' : 'val-neg') : ''}">${f.ret5 !== null ? f.ret5 + '%' : '—'}</td>
            <td class="${f.ret10 !== null ? (f.ret10 >= 0 ? 'val-pos' : 'val-neg') : ''}">${f.ret10 !== null ? f.ret10 + '%' : '—'}</td>
            <td class="${f.retAll !== null ? (f.retAll >= 0 ? 'val-pos' : 'val-neg') : ''}">${f.retAll !== null ? f.retAll + '%' : '—'}</td>
            <td>${f.maxPlus !== null ? f.maxPlus + '%' : '—'}</td>
            <td>${f.maxMinus !== null ? f.maxMinus + '%' : '—'}</td>
            <td><span class="aum-tag">${formatAUM(f.aum)}</span></td>
            <td>${f.ter}%</td>
            <td>${costPrice === "WARNING" ? '<div class="warning-circle" data-tooltip="Fond v tomto horizontu svým výkonem nepokryl ani vlastní poplatky.">×</div>' : costPrice === "—" ? '<strong>—</strong>' : `<strong style="color: ${getCostPriceColor(costPrice)}">${costPrice}%</strong>`}</td>
            <td>${createSparkline(f.sparkline)}</td>
        `;
        tbody.appendChild(tr);
        
        // Přidat detailní řádek pro testovací fond
        if (isTestFund) {
            const detailRow = document.createElement('tr');
            detailRow.className = 'fund-details';
            detailRow.style.display = 'none';
            const colCount = tr.querySelectorAll('td').length;
            detailRow.innerHTML = `
                <td colspan="${colCount}">
                    <div class="fund-details-content">
                        <h3>Detailní informace o fondu</h3>
                        <p>Zde budou další detaily fondu ${f.name}</p>
                        <p>TER: ${f.ter}%</p>
                        <p>AuM: ${formatAUM(f.aum)}</p>
                    </div>
                </td>
            `;
            tbody.appendChild(detailRow);
            
            // Click handler pro rozbalení/sbalení
            tr.addEventListener('click', (e) => {
                // Zabraňit rozbalení při kliknutí na warning circle (nechat tooltip fungovat)
                if (e.target.closest('.warning-circle')) {
                    return;
                }
                
                // Rozbalit/sbalit detaily
                const isExpanded = tr.getAttribute('data-expanded') === 'true';
                if (isExpanded) {
                    detailRow.style.display = 'none';
                    tr.setAttribute('data-expanded', 'false');
                } else {
                    detailRow.style.display = 'table-row';
                    tr.setAttribute('data-expanded', 'true');
                }
            });
        }
    });
    
    // Event listenery pro hvězdičky (oblíbené)
    document.querySelectorAll('.favorite-star').forEach(star => {
        star.addEventListener('click', (e) => {
            e.stopPropagation(); // Zabraňit rozbalení řádku
            const fundId = parseInt(star.getAttribute('data-fund-id'));
            if (favoriteFunds.has(fundId)) {
                favoriteFunds.delete(fundId);
                star.innerHTML = '&#9734;';
            } else {
                favoriteFunds.add(fundId);
                star.innerHTML = '&#9733;';
            }
            // Pokud je aktivní filtr oblíbených, aktualizovat tabulku
            if (showFavoritesOnly) {
                applyFilters();
            }
        });
    });
    
    // Reinicializace tooltips po renderování (pro warning-circle)
    initTooltips();
}

// 3. SORTING & FILTERING
function sortTable(colIdx) {
    // První sloupec (index 0) je hvězdička, takže colIdx odpovídá přímo keys
    const keys = ['id', 'name', 'provider', 'ret5', 'ret10', 'retAll', 'maxPlus', 'maxMinus', 'aum', 'ter', 'costPrice'];
    const key = keys[colIdx];
    
    currentSort.desc = currentSort.column === colIdx ? !currentSort.desc : true;
    currentSort.column = colIdx;

    fundsData.sort((a, b) => {
        let valA, valB;
        
        // Handle costPrice - calculate dynamically
        if (key === 'costPrice') {
            const costA = calculateCostPrice(a);
            const costB = calculateCostPrice(b);
            // WARNING má nejvyšší hodnotu pro řazení (bude na konci při sestupném řazení)
            valA = costA === "WARNING" ? 9999 : costA === "—" ? 999 : parseFloat(costA);
            valB = costB === "WARNING" ? 9999 : costB === "—" ? 999 : parseFloat(costB);
        } else if (key === 'provider') {
            // Sort by provider text
            valA = a.provider.text;
            valB = b.provider.text;
            return currentSort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        } else {
            valA = a[key] === null ? -999 : a[key];
            valB = b[key] === null ? -999 : b[key];
        }

        // Handle string values (only for 'name')
        if (typeof valA === 'string' && key === 'name') {
            return currentSort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }

        // Ensure numeric values are compared as numbers
        valA = typeof valA === 'string' ? parseFloat(valA) : valA;
        valB = typeof valB === 'string' ? parseFloat(valB) : valB;

        return currentSort.desc ? valB - valA : valA - valB;
    });

    applyFilters();
}

// Default Sort Logic (10y or 5y fallback)
function initialSort() {
    fundsData.sort((a, b) => {
        const valA = a.ret10 !== null ? a.ret10 : a.ret5;
        const valB = b.ret10 !== null ? b.ret10 : b.ret5;
        return valB - valA;
    });
    applyFilters();
}

// Funkce pro aplikování filtrů (vyhledávání + oblíbené)
function applyFilters() {
    let filtered = fundsData;
    
    // Filtr oblíbených
    if (showFavoritesOnly) {
        filtered = filtered.filter(f => favoriteFunds.has(f.id));
    }
    
    // Vyhledávání
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(f => f.name.toLowerCase().includes(searchTerm));
    }
    
    renderTable(filtered);
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', () => {
    applyFilters();
});

// Tlačítko "Oblíbené"
document.getElementById('favoritesBtn').addEventListener('click', () => {
    showFavoritesOnly = !showFavoritesOnly;
    const btn = document.getElementById('favoritesBtn');
    if (showFavoritesOnly) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
    applyFilters();
});

// Tooltip functionality - použití event delegation
let tooltip = null;

function initTooltips() {
    // Odstranit starý listener pokud existuje
    const tableBody = document.getElementById('tableBody');
    if (tableBody._tooltipHandler) {
        tableBody.removeEventListener('mouseenter', tableBody._tooltipHandler, true);
        tableBody.removeEventListener('mouseleave', tableBody._tooltipHandler, true);
    }
    
    // Nový handler s event delegation
    tableBody._tooltipHandler = (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) {
            if (tooltip && e.type === 'mouseleave') {
                tooltip.style.opacity = '0';
                setTimeout(() => {
                    if (tooltip && tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                    tooltip = null;
                }, 200);
            }
            return;
        }
        
        if (e.type === 'mouseenter') {
            const text = target.getAttribute('data-tooltip');
            if (!text) return;
            
            tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.textContent = text;
            document.body.appendChild(tooltip);
            
            // Force layout calculation
            tooltip.style.visibility = 'hidden';
            tooltip.style.display = 'block';
            
            const rect = target.getBoundingClientRect();
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;
            
            let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            let top = rect.top - tooltipHeight - 8;
            
            // Ensure tooltip stays within viewport
            if (left < 10) left = 10;
            if (left + tooltipWidth > window.innerWidth - 10) {
                left = window.innerWidth - tooltipWidth - 10;
            }
            if (top < 10) {
                top = rect.bottom + 8;
            }
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '0';
            
            setTimeout(() => {
                if (tooltip) {
                    tooltip.style.opacity = '1';
                }
            }, 10);
        } else if (e.type === 'mouseleave') {
            if (tooltip) {
                tooltip.style.opacity = '0';
                setTimeout(() => {
                    if (tooltip && tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                    tooltip = null;
                }, 200);
            }
        }
    };
    
    tableBody.addEventListener('mouseenter', tableBody._tooltipHandler, true);
    tableBody.addEventListener('mouseleave', tableBody._tooltipHandler, true);
    
    // Také pro hlavičku tabulky (sloupce)
    const thead = document.querySelector('thead');
    if (thead) {
        if (thead._tooltipHandler) {
            thead.removeEventListener('mouseenter', thead._tooltipHandler, true);
            thead.removeEventListener('mouseleave', thead._tooltipHandler, true);
        }
        
        thead._tooltipHandler = (e) => {
            const target = e.target.closest('[data-tooltip]');
            
            if (e.type === 'mouseenter') {
                if (!target) return;
                
                const text = target.getAttribute('data-tooltip');
                if (!text) return;
                
                // Zavřít existující tooltip pokud existuje
                if (tooltip) {
                    tooltip.style.opacity = '0';
                    setTimeout(() => {
                        if (tooltip && tooltip.parentNode) {
                            tooltip.parentNode.removeChild(tooltip);
                        }
                        tooltip = null;
                    }, 100);
                }
                
                tooltip = document.createElement('div');
                tooltip.className = 'custom-tooltip';
                tooltip.textContent = text;
                document.body.appendChild(tooltip);
                
                tooltip.style.visibility = 'hidden';
                tooltip.style.display = 'block';
                
                const rect = target.getBoundingClientRect();
                const tooltipWidth = tooltip.offsetWidth;
                const tooltipHeight = tooltip.offsetHeight;
                
                let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
                let top = rect.top - tooltipHeight - 8;
                
                if (left < 10) left = 10;
                if (left + tooltipWidth > window.innerWidth - 10) {
                    left = window.innerWidth - tooltipWidth - 10;
                }
                if (top < 10) {
                    top = rect.bottom + 8;
                }
                
                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
                tooltip.style.visibility = 'visible';
                tooltip.style.opacity = '0';
                
                setTimeout(() => {
                    if (tooltip) {
                        tooltip.style.opacity = '1';
                    }
                }, 10);
            } else if (e.type === 'mouseleave') {
                // Zavřít tooltip když uživatel opustí element s tooltipem nebo celý thead
                if (!target || !e.relatedTarget || !thead.contains(e.relatedTarget)) {
                    if (tooltip) {
                        tooltip.style.opacity = '0';
                        setTimeout(() => {
                            if (tooltip && tooltip.parentNode) {
                                tooltip.parentNode.removeChild(tooltip);
                            }
                            tooltip = null;
                        }, 200);
                    }
                }
            }
        };
        
        thead.addEventListener('mouseenter', thead._tooltipHandler, true);
        thead.addEventListener('mouseleave', thead._tooltipHandler, true);
    }
}

// Performance selection handler
document.getElementById('performanceSelect').addEventListener('change', (e) => {
    selectedPerformance = e.target.value;
    applyFilters();
});

// Načtení a zobrazení indexů
async function loadIndices() {
    try {
        const response = await fetch('./indices-data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        const containerWrapper = document.getElementById('indicesContainerWrapper');
        if (!containerWrapper) return;
        
        // Kontejner pro indexy zarovnaný s levým okrajem
        const indicesList = document.createElement('div');
        indicesList.className = 'indices-list';
        
        data.forEach(index => {
            const item = document.createElement('div');
            item.className = 'index-item';
            
            const info = document.createElement('div');
            info.className = 'index-info';
            
            const name = document.createElement('div');
            name.className = 'index-name';
            name.textContent = index.name;
            
            const change = document.createElement('div');
            change.className = 'index-change';
            change.classList.add(index.change24h >= 0 ? 'positive' : 'negative');
            change.textContent = `${index.change24h >= 0 ? '+' : ''}${index.change24h.toFixed(1)}%`;
            
            info.appendChild(name);
            info.appendChild(change);
            
            // Pro měnové kurzy zobrazit kurz, pro indexy sparkline
            if (index.isCurrency) {
                const rateContainer = document.createElement('div');
                rateContainer.className = 'index-rate';
                rateContainer.textContent = index.rate.toFixed(2);
                item.appendChild(info);
                item.appendChild(rateContainer);
            } else {
                const sparklineContainer = document.createElement('div');
                sparklineContainer.className = 'index-sparkline';
                sparklineContainer.innerHTML = createSparkline(index.sparkline, 80, 20);
                item.appendChild(info);
                item.appendChild(sparklineContainer);
            }
            
            indicesList.appendChild(item);
        });
        
        containerWrapper.appendChild(indicesList);
    } catch (error) {
        console.warn('Nepodařilo se načíst data indexů:', error);
    }
}

// Init - načtení dat a inicializace
async function init() {
    // Načíst indexy
    await loadIndices();
    
    try {
        fundsData = await loadFundsData();
        if (fundsData && fundsData.length > 0) {
            initialSort();
            initTooltips();
        } else {
            console.error('Nepodařilo se načíst data fondů');
            // Zkusíme ještě jednou s generovanými daty
            fundsData = generateData();
            initialSort();
            initTooltips();
        }
    } catch (error) {
        console.error('Chyba při inicializaci:', error);
        // Fallback na generovaná data
        fundsData = generateData();
        initialSort();
        initTooltips();
    }
}

// AI Button toggle functionality
function initAIButton() {
    const aiButton = document.getElementById('aiButton');
    const aiCloseBtn = document.getElementById('aiCloseBtn');
    const aiResponse = document.getElementById('aiResponse');
    const aiOptions = document.getElementById('aiOptions');
    
    if (aiButton) {
        // Odpovědi pro jednotlivé otázky (kolem 150 slov)
        const responses = {
            market: "Situace na trzích v závěru roku 2025 je definována vysokou volatilitou a silným postavením drahých kovů. Zlato dosahuje historických maxim nad 4 500 USD za unci, poháněné nákupy centrálních bank. Stříbro zažívá boom díky průmyslové poptávce (čipy, fotovoltaika) a testuje hranici 75 USD. V technologickém sektoru dominuje AI, kde trh nyní odměňuje firmy s reálnými zisky z implementace, nikoliv jen s vizemi. Investice se soustředí zejména na infrastrukturu a energetiku pro datová centra. Geopolitika zůstává klíčovým rizikem. Napětí v globálním obchodě a regionální konflikty udržují poptávku po „bezpečných přístavech“ a ovlivňují ceny energií. S očekávaným snižováním sazeb centrálními bankami se otevírá prostor pro růst akcií, ale i pro měnové výkyvy. Doporučujeme diverzifikaci a revizi portfolia vzhledem k rekordním cenám kovů a ukazatelům aplikovaným na celý americký akciový trh.",
            interesting: "Právě teď dokončujeme integraci revolučního AI asistenta do naší mobilní aplikace, který bude v reálném čase analyzovat vaše výdaje a automaticky navrhovat optimalizaci spoření, a zároveň v prvním kvartálu příštího roku spouštíme exkluzivní platformu pro frakční investování do vzácných kovů a ekologických startupů přímo z vašeho běžného účtu. Vedle toho připravujeme zcela nový věrnostní program založený na technologii blockchain, který vám umožní sbírat digitální tokeny za každou platbu kartou a následně je měnit za prémiové bankovní služby nebo slevy u našich globálních partnerů v oblasti cestování. Naši klienti se mohou těšit také na virtuální pobočku v metaverse, kde budeme poskytovat personalizované finanční poradenství v imerzivním prostředí, a na zavedení biometrických plateb pomocí skenu dlaně pro maximální bezpečnost a pohodlí při nakupování. V nejbližších dnech také představíme dynamický algoritmus pro automatizované sestavování investičních portfolií na míru, který reaguje na okamžité změny světových trhů a geopolitickou situaci.",
            warning: "Při investování je nejdůležitější vyvarovat se sázce na jedinou kartu a nenechat se strhnout krátkodobými emocemi, protože největším rizikem pro vaše úspory zůstává nedostatečná diverzifikace a pokusy o časování trhu bez hlubokých dat. Naše profesionálně spravované fondy jsou navrženy tak, aby toto riziko eliminovaly rozložením kapitálu mezi stovky prověřených titulů, čímž zajišťují stabilitu i v době zvýšené geopolitické nejistoty a tržních výkyvů. Správa portfolia našimi experty vám navíc garantuje okamžitou reakci na technologické trendy, jako je rozmach umělé inteligence, aniž byste museli sami sledovat složité grafy nebo riskovat kapitál u neprověřených platforem. Využitím našich investičních řešení získáváte jistotu, že vaše portfolio je neustále vyvažováno tak, aby maximalizovalo výnos při zachování bezpečné úrovně rizika, což je základem dlouhodobého budování majetku v moderním finančním světě. Aktuálně se ukazuje, že kombinace akciových fondů s našimi konzervativními produkty nabízí ideální poměr mezi ochranou proti inflaci a participací na globálním růstu.",
            high: "Akciové trhy se skutečně nacházejí na vysokých úrovních, což potvrzuje ukazatel P/E (poměr ceny k ziskům), kdy u amerického indexu S&P 500 investoři aktuálně platí zhruba 31násobek ročních zisků firem, zatímco globální index MSCI World se pohybuje kolem 24násobku. Ještě opatrnější pohled nabízí Shillerovo PE (CAPE), které očišťuje zisky o inflaci za posledních 10 let a u amerických akcií dosahuje hodnoty přes 40, což je historicky velmi vysoko a signalizuje, že trh je „drahý“. Naproti tomu evropský index STOXX 600 s hodnotou kolem 18 působí mnohem střízlivěji a nabízí prostor pro růst tam, kde americké technologické tituly již narazily na svůj strop. Právě proto je nyní klíčové nesázet jen na populární americké indexy, ale využít naše aktivně spravované fondy, které dokážou identifikovat podhodnocené příležitosti v Evropě či v sektorech, které nejsou tak „přehřáté“. Diverzifikací přes naše expertní řešení se vyhnete riziku nákupu na vrcholu a zajistíte si stabilnější výnos i v případě, že na drahých trzích dojde ke korekci, protože profesionální správa portfolia včas přesouvá kapitál tam, kde je poměr ceny a očekávaného výnosu stále příznivý.",
            sell: "Naprosto rozumím tomu, že pohled na červená čísla v portfoliu může být znepokojivý, ale propady v jsou v investičním světě zcela přirozeným projevem tržního „dýchání“ a rozhodně nejsou důvodem k ukvapenému prodeji. Historická data ukazují, že prodej v momentě mírného poklesu je nejčastější chybou, která investory připravuje o budoucí zisky, protože realizují ztrátu těsně předtím, než se trhy opět nadechnou k růstu. Naše strategie a fondy jsou nastaveny na dlouhodobý horizont právě proto, aby tyto krátkodobé výkyvy, způsobené momentální náladou nebo geopolitickou zprávou, úspěšně překonaly. Místo paniky je nyní vhodnější čas na zachování klidu a disciplíny, protože právě v těchto momentech se ukazuje síla diverzifikovaného portfolia, které chrání váš kapitál před hlubšími propady. Pokud se přesto cítíte nejistí, rádi vám sjednáme osobní konzultaci s naším bankéřem, který s vámi v klidu projde složení vašich investic a potvrdí, zda jsou stále v souladu s vašimi cíli.",
            crypto: "Kryptoměny v roce 2025 již nejsou jen spekulativním nástrojem, ale stávají se uznávanou součástí moderních portfolií díky rostoucí adopci technologie blockchain v bankovnictví, která umožňuje bleskové přeshraniční platby a bezpečnou tokenizaci reálných aktiv. Přestože schválení spotových ETF a jasnější regulace (např. evropský rámec MiCA) přinesly trhu větší stabilitu a důvěryhodnost, kryptoměny si zachovávají svou typickou vysokou volatilitu, která může vést k prudkým cenovým výkyvům v krátkém čase. Z pohledu profesionální správy majetku proto dávají smysl především jako doplňková složka portfolia, kde doporučujeme držet maximálně 5 % celkového objemu investic, aby potenciální růst digitálních aktiv podpořil váš výnos, aniž by neúměrně ohrozil vaši celkovou finanční stabilitu. Naše bankovní fondy a investiční strategie již tyto trendy reflektují a umožňují vám participovat na rozvoji digitální ekonomiky skrze prověřené a regulované nástroje, které kombinují dravost technologií s bezpečností tradičního bankovního dohledu. Tento vyvážený přístup vám zajistí, že nepropásnete technologickou revoluci, ale zároveň zůstanete chráněni před extrémními riziky, která jsou s přímým držením neregulovaných kryptoaktiv stále spojena."
        };
        
        // Funkce pro zobrazení odpovědi postupně po jednom slově, rozdělené do tří odstavců
        function displayResponse(responseText) {
            aiResponse.innerHTML = '';
            const words = responseText.split(' ');
            const wordsPerParagraph = Math.ceil(words.length / 3);
            
            // Vytvořit tři odstavce
            const paragraphs = [];
            for (let i = 0; i < 3; i++) {
                const paragraph = document.createElement('p');
                paragraph.className = 'ai-response-paragraph';
                paragraphs.push(paragraph);
                aiResponse.appendChild(paragraph);
            }
            
            let currentIndex = 0;
            let currentParagraph = 0;
            
            function addNextWord() {
                if (currentIndex < words.length) {
                    const wordSpan = document.createElement('span');
                    wordSpan.className = 'ai-response-word';
                    const word = words[currentIndex];
                    wordSpan.textContent = word + (currentIndex < words.length - 1 ? ' ' : '');
                    paragraphs[currentParagraph].appendChild(wordSpan);
                    currentIndex++;
                    
                    // Přepnout na další odstavec po určitém počtu slov
                    if (currentIndex > 0 && currentIndex % wordsPerParagraph === 0 && currentParagraph < 2) {
                        currentParagraph++;
                    }
                    
                    setTimeout(addNextWord, 100); // 100ms mezi slovy
                }
            }
            
            addNextWord();
        }
        
        // Event listener pro kliknutí na tlačítko (rozbalení/sbalení)
        aiButton.addEventListener('click', (e) => {
            // Pokud klikneme na možnost, křížek nebo odpověď, nechat to být
            if (e.target.closest('.ai-option') || e.target.closest('.ai-close-btn') || e.target.closest('.ai-response')) {
                return;
            }
            
            // Pokud je už odpověď zobrazena, nechat to být
            if (aiButton.classList.contains('answered')) {
                return;
            }
            
            aiButton.classList.toggle('expanded');
        });
        
        // Event listener pro křížek
        if (aiCloseBtn) {
            aiCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                aiButton.classList.remove('expanded', 'answered');
                aiResponse.innerHTML = '';
            });
        }
        
        // Event listenery pro možnosti
        if (aiOptions) {
            aiOptions.querySelectorAll('.ai-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const questionType = option.getAttribute('data-question');
                    const response = responses[questionType];
                    
                    if (response) {
                        // Přidat třídu "answered" pro změnu layoutu
                        aiButton.classList.add('answered');
                        
                        // Zobrazit odpověď postupně
                        displayResponse(response);
                    }
                });
            });
        }
    }
}

// Inicializace Fear & Greed Index
function initFearGreedIndex() {
    const fearGreedElement = document.getElementById('fearGreedValue');
    const fearGreedCard = document.getElementById('fearGreedCard');
    const fearGreedMood = document.getElementById('fearGreedMood');
    
    if (fearGreedElement && fearGreedCard && fearGreedMood) {
        // Náhodná hodnota mezi 0 a 100
        const randomValue = Math.floor(Math.random() * 101);
        fearGreedElement.textContent = randomValue;
        
        // Určit náladu podle hodnoty
        let mood;
        if (randomValue <= 20) {
            mood = 'Investoři se bojí';
        } else if (randomValue <= 40) {
            mood = 'Na trhu panují obavy';
        } else if (randomValue <= 60) {
            mood = 'Nálada na trhu je neutrální';
        } else if (randomValue <= 80) {
            mood = 'Mírný optimismus';
        } else {
            mood = 'Všichni nakupují';
        }
        fearGreedMood.textContent = mood;
        
        // Nastavit barvu pozadí podle hodnoty
        let bgColor;
        if (randomValue <= 20) {
            bgColor = '#EA3943'; // Červená
        } else if (randomValue <= 40) {
            bgColor = '#EA8C00'; // Oranžová
        } else if (randomValue <= 60) {
            bgColor = '#F3D42F'; // Žlutá
        } else if (randomValue <= 80) {
            bgColor = '#93D900'; // Světle zelená
        } else {
            bgColor = '#16C784'; // Zelená
        }
        
        fearGreedCard.style.backgroundColor = bgColor;
        
        // Nastavit barvu textu podle pozadí
        if (randomValue <= 40) {
            // Pro červenou (0-20) a oranžovou (21-40) použijeme bílý text
            fearGreedCard.style.color = '#ffffff';
        } else {
            // Pro žlutou (41-60), světle zelenou (61-80) a zelenou (81-100) použijeme černý text
            fearGreedCard.style.color = '#1d1d1f';
        }
    }
}

// Inicializace barev ikon v mega menu
function initMegaMenuIcons() {
    const colors = [
        '#2770F0',
        '#00A3A5',
        '#008663',
        '#FE6231',
        '#701D79',
        '#0BB43F',
        '#EA4D7A',
        '#235377',
        '#D2CCA1',
        '#BEFFC7',
        '#DBD3C9'
    ];
    
    // Funkce pro přiřazení barev ikonám
    function assignColors(selector) {
        const menuItems = document.querySelectorAll(selector);
        let previousColor = null;
        
        menuItems.forEach((icon) => {
            let availableColors = colors;
            
            // Pokud existuje předchozí barva, odstraníme ji z dostupných barev
            if (previousColor) {
                availableColors = colors.filter(color => color !== previousColor);
            }
            
            // Náhodně vybereme barvu z dostupných
            const randomIndex = Math.floor(Math.random() * availableColors.length);
            const selectedColor = availableColors[randomIndex];
            
            icon.style.backgroundColor = selectedColor;
            previousColor = selectedColor;
        });
    }
    
    // Přiřadit barvy ikonám v menu Filtry
    assignColors('.mega-menu-filters .menu-item-icon');
    
    // Přiřadit barvy ikonám v menu Research
    assignColors('.mega-menu-research .menu-item-icon');
}

// Mobilní menu - burger menu a overlay
function initMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    const body = document.body;

    if (!mobileMenuToggle || !mobileMenuClose || !mobileNavOverlay) return;

    // Otevření menu
    mobileMenuToggle.addEventListener('click', () => {
        mobileNavOverlay.classList.add('active');
        mobileMenuToggle.classList.add('hidden');
        body.style.overflow = 'hidden';
    });

    // Zavření menu
    mobileMenuClose.addEventListener('click', () => {
        mobileNavOverlay.classList.remove('active');
        mobileMenuToggle.classList.remove('hidden');
        body.style.overflow = '';
    });

    // Zavření při kliknutí mimo menu
    mobileNavOverlay.addEventListener('click', (e) => {
        if (e.target === mobileNavOverlay) {
            mobileNavOverlay.classList.remove('active');
            mobileMenuToggle.classList.remove('hidden');
            body.style.overflow = '';
        }
    });

    // Rozbalování submenu v mobilní navigaci
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link[data-mobile-nav]');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-mobile-nav');
            const submenu = document.getElementById(`mobileNav${targetId.charAt(0).toUpperCase() + targetId.slice(1)}`);
            
            if (submenu) {
                const isActive = link.classList.contains('active');
                
                // Zavřít všechny ostatní submenu
                mobileNavLinks.forEach(l => {
                    if (l !== link) {
                        l.classList.remove('active');
                        const otherSubmenuId = l.getAttribute('data-mobile-nav');
                        const otherSubmenu = document.getElementById(`mobileNav${otherSubmenuId.charAt(0).toUpperCase() + otherSubmenuId.slice(1)}`);
                        if (otherSubmenu) {
                            otherSubmenu.classList.remove('active');
                        }
                    }
                });
                
                // Toggle aktuální submenu
                if (isActive) {
                    link.classList.remove('active');
                    submenu.classList.remove('active');
                } else {
                    link.classList.add('active');
                    submenu.classList.add('active');
                }
            }
        });
    });
}

// Rozbalování novinek na mobilu
function initNewsExpand() {
    const newsExpandBtn = document.getElementById('newsExpandBtn');
    const hiddenNewsCards = document.querySelectorAll('.news-card-hidden');

    if (!newsExpandBtn || hiddenNewsCards.length === 0) return;

    newsExpandBtn.addEventListener('click', () => {
        const isExpanded = newsExpandBtn.classList.contains('expanded');
        
        if (isExpanded) {
            // Sbalit
            hiddenNewsCards.forEach(card => {
                card.classList.remove('active');
            });
            newsExpandBtn.classList.remove('expanded');
        } else {
            // Rozbalit
            hiddenNewsCards.forEach(card => {
                card.classList.add('active');
            });
            newsExpandBtn.classList.add('expanded');
        }
    });
}

// Spustit inicializaci po načtení stránky
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        initAIButton();
        initFearGreedIndex();
        initMegaMenuIcons();
        initMobileMenu();
        initNewsExpand();
    });
} else {
    init();
    initAIButton();
    initFearGreedIndex();
    initMegaMenuIcons();
    initMobileMenu();
    initNewsExpand();
}