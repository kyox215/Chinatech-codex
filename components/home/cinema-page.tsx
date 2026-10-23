"use client";

import { NavigationLink as Link } from "@/components/navigation-link";
import { useLanguage } from "@/components/language-provider";
import { getOpenFilms, openFilmAttributions } from "@/lib/open-films";
import { TutorialLibrary } from "./tutorial-library";
import { PublicHeader } from "./public-header";
import { PublicBreadcrumb } from "./public-breadcrumb";
import { PersonalFooter } from "./personal-footer";
import home from "./home.module.css";
import styles from "./portal.module.css";

export function CinemaPage() {
  const { t } = useLanguage();
  return <div className={styles.page}>
    <Link className={home.skipLink} href="#main-content" focusTargetId="main-content">{t("跳到主要内容")}</Link>
    <PublicHeader page="cinema" />
    <PublicBreadcrumb title={t("放映室")} />
    <main className={`${styles.main} ${styles.cinemaMain}`} id="main-content" tabIndex={-1}>
      <section className={styles.introduction} aria-labelledby="cinema-title">
        <h1 id="cinema-title">{t("放映室")}</h1>
        <p>{t("三部开放授权短片，选一部开始观看。")}</p>
      </section>
      <TutorialLibrary tutorials={getOpenFilms(t)} aspectRatio="16:9" variant="film" attributions={openFilmAttributions} />
    </main>
    <PersonalFooter />
  </div>;
}
