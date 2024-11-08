export type CFWebcatalogCircleLink = string | null;

export type CFWebcatalogCircleLinks = string[] | null;

export type CFWebcatalogCircleFandom = string | "-" | null;

export type CFWebcatalogCircleRating = "PG" | "GA" | "M";

export type CFWebcatalogCircleDay = "Both Days" | "SAT" | "SUN";

export type CFWebCatalogCircleType = "Booth_B" | "Booth_A" | "4 Space(s)" | "2 Space(s)" | "1 Space(s)";

export interface CFWebcatalogCircle {
    id: number|string,
    user_id: string,
    circle_code: string,
    name: string,
    circle_cut: CFWebcatalogCircleLink,
    SellsCommision: boolean,
    SellsComic: boolean,
    SellsArtbook: boolean,
    SellsPhotobookGeneral: boolean,
    SellsNovel: boolean,
    SellsGame: boolean,
    SellsMusic: boolean,
    SellsGoods: boolean,
    circle_facebook: CFWebcatalogCircleLink,
    circle_instagram: CFWebcatalogCircleLink,
    circle_twitter: CFWebcatalogCircleLink,
    circle_other_socials: CFWebcatalogCircleLink,
    marketplace_link: CFWebcatalogCircleLink,
    fandom: CFWebcatalogCircleFandom,
    other_fandom: CFWebcatalogCircleFandom,
    rating: CFWebcatalogCircleRating,
    sampleworks_images: CFWebcatalogCircleLinks,
    day: CFWebcatalogCircleDay,
    SellsHandmadeCrafts: boolean,
    SellsMagazine: boolean,
    SellsPhotobookCosplay: boolean,
    circleType?: CFWebCatalogCircleType,
}