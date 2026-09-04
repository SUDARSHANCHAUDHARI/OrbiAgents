import { app } from 'electron';
import { configureMigrationStorage } from './migrationStorage';

// This side-effect module must be the first import in the main entry point.
configureMigrationStorage(app);
