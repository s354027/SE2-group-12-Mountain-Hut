import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) { // creates tables and indexes
    const sequelize = queryInterface.sequelize;

    await sequelize.transaction(async transaction => {
        const options = { transaction };

        // 1. USERS
        await queryInterface.createTable('users', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            firstName: {
                type: DataTypes.STRING,
                allowNull: false
            },
            lastName: {
                type: DataTypes.STRING,
                allowNull: false
            },
            email: {
                type: DataTypes.STRING,
                allowNull: true,
                unique: true
            },
            phone: {
                type: DataTypes.STRING,
                allowNull: true
            },
            role: {
                type: DataTypes.STRING,
                allowNull: false
            }
        }, options);

        // 2. DINING TABLES
        await queryInterface.createTable('dining_tables', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            tableNumber: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true
            },
            seats: {
                type: DataTypes.INTEGER,
                allowNull: false
            }
        }, options);

        // 3. SLOTS
        await queryInterface.createTable('slots', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            date: {
                type: DataTypes.DATEONLY,
                allowNull: false
            },
            startTime: {
                type: DataTypes.TIME,
                allowNull: false
            },
            duration: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            totalCapacity: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false
            }
        }, options);

        // 4. BOOKINGS
        await queryInterface.createTable('bookings', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            hikerId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            slotId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'slots',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            numberOfPeople: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false
            },
            allergyFlag: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            allergyDescription: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        }, options);

        // 5. MENUS
        await queryInterface.createTable('menus', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            slotId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'slots',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            managerId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            }
        }, options);

        // 6. BOOKING - TABLE ASSOCIATION
        await queryInterface.createTable('booking_tables', {
            bookingId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                references: {
                    model: 'bookings',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            tableId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                references: {
                    model: 'dining_tables',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            }
        }, options);

        // 7. SLOT - TABLE ASSOCIATION
        await queryInterface.createTable('slot_tables', {
            slotId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                references: {
                    model: 'slots',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            tableId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                references: {
                    model: 'dining_tables',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            }
        }, options);

        // 8. INDEXES FOR COMMON LOOKUPS
        await queryInterface.addIndex(
        'bookings', ['hikerId'],
        { name: 'idx_bookings_hiker', transaction }
        );

        await queryInterface.addIndex(
        'bookings', ['slotId'],
        { name: 'idx_bookings_slot', transaction }
        );

        await queryInterface.addIndex(
        'menus', ['slotId'],
        { name: 'idx_menus_slot', transaction }
        );

        await queryInterface.addIndex(
        'menus', ['managerId'],
        { name: 'idx_menus_manager', transaction }
        );

        await queryInterface.addIndex(
        'booking_tables', ['tableId'],
        { name: 'idx_booking_tables_table', transaction }
        );

        await queryInterface.addIndex(
        'slot_tables', ['tableId'],
        { name: 'idx_slot_tables_table', transaction }
        );
    });
}

export async function down({ context: queryInterface }) { //drops tables and ends migrations
    const sequelize = queryInterface.sequelize;

    await sequelize.transaction(async transaction => {
        const options = { transaction };

        // Drop tables in reverse dependency order
        await queryInterface.dropTable('slot_tables', options);
        await queryInterface.dropTable('booking_tables', options);
        await queryInterface.dropTable('menus', options);
        await queryInterface.dropTable('bookings', options);
        await queryInterface.dropTable('slots', options);
        await queryInterface.dropTable('dining_tables', options);
        await queryInterface.dropTable('users', options);
    });
}
