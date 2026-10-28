import sequelize from './sequelize.js';
import { initModels } from '../models/index.js';

// Initialize all models and their associations
const models = initModels(sequelize);

export { sequelize, models };
