import EventList from "./EventList";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.brand}>Tartan Tickets</p>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>Upcoming events</h1>
        <p className={styles.subheading}>Club events happening in the next 7 days.</p>
        <EventList />
      </main>
    </div>
  );
}
