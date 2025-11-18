import type { PackageUnits, StoreSettings } from '../types';

export const formatStockToPackagesAndUnits = (totalStock: number, itemsPerPackage?: number): string => {
    if (!itemsPerPackage || itemsPerPackage <= 1) {
        return totalStock.toLocaleString('fa-IR');
    }
    const packages = Math.floor(totalStock / itemsPerPackage);
    const units = totalStock % itemsPerPackage;

    if (packages > 0 && units > 0) {
        return `${packages.toLocaleString('fa-IR')} بسته و ${units.toLocaleString('fa-IR')} عدد`;
    }
    if (packages > 0) {
        return `${packages.toLocaleString('fa-IR')} بسته`;
    }
    return `${units.toLocaleString('fa-IR')} عدد`;
};


export const parseToTotalUnits = (packages: number, units: number, itemsPerPackage: number): number => {
    return (packages * itemsPerPackage) + units;
};

export const parseToPackageAndUnits = (totalStock: number, itemsPerPackage: number): PackageUnits => {
    if (itemsPerPackage <= 1) {
        return { packages: 0, units: totalStock };
    }
    const packages = Math.floor(totalStock / itemsPerPackage);
    const units = totalStock % itemsPerPackage;
    return { packages, units };
};

export const formatCurrency = (amount: number, settings: StoreSettings): string => {
    const roundedAmount = Math.round(amount);
    return `${roundedAmount.toLocaleString('fa-IR')} ${settings.currencyName}`;
};

export const numberToPersianWords = (num: number): string => {
    if (num === 0) return 'صفر';

    const units = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
    const teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
    const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
    const hundreds = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
    const thousands = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

    let numStr = String(Math.round(num));
    if (numStr.length > 15) return 'عدد بسیار بزرگ';

    const groups = [];
    while (numStr.length > 0) {
        groups.push(numStr.slice(-3));
        numStr = numStr.slice(0, -3);
    }

    let words = [];
    for (let i = groups.length - 1; i >= 0; i--) {
        const group = parseInt(groups[i], 10);
        if (group === 0) continue;

        const groupWords = [];
        const h = Math.floor(group / 100);
        const t = Math.floor((group % 100) / 10);
        const u = group % 10;

        if (h > 0) {
            groupWords.push(hundreds[h]);
        }

        if (t === 1) {
            groupWords.push(teens[u]);
        } else {
            if (t > 1) {
                groupWords.push(tens[t]);
            }
            if (u > 0) {
                groupWords.push(units[u]);
            }
        }
        
        words.push(groupWords.join(' و '));
        if (i > 0) {
            words.push(thousands[i]);
        }
    }

    return words.join(' و ');
};
