const { Client } = require('pg');

const dbUrl = "postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway";

async function run() {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    
    // Truncate tables correctly
    await client.query(`
      TRUNCATE TABLE 
        lms_certificates,
        lms_registrations,
        lms_batch_sessions,
        lms_course_batches,
        learning_lesson_progress,
        learning_enrollments,
        learning_lessons,
        learning_courses,
        learning_tracks
      CASCADE;
    `);
    
    console.log("Semua data testing LMS berhasil di-reset!");
  } catch (err) {
    console.error("Error executing:", err.message);
  } finally {
    await client.end();
  }
}

run();
