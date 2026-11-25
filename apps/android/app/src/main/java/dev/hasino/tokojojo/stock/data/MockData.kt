package dev.hasino.tokojojo.stock.data

object MockData {
    private fun unit(
        id: String,
        name: String,
        conversion: Int,
        price: Long,
        barcode: String,
    ) = ProductUnit(id, name, conversion, price, barcode)

    val suppliers =
        listOf(
            Supplier("SUP-01", "CV Sumber Rejeki", "0812-7700-1122"),
            Supplier("SUP-02", "UD Makmur Abadi", "0813-6611-9088"),
            Supplier("SUP-03", "PT Sinar Pangan Nusantara", "0778-451-220"),
        )

    val products =
        listOf(
            Product(
                id = "PRD-001",
                sku = "SMB-BRS-001",
                barcode = "8992761110012",
                name = "Beras Setra Ramos Cap Topi Koki 5kg",
                category = "Sembako",
                units = listOf(unit("U-001", "Karung", 1, 73_500, "8992761110012")),
                cost = 64_200,
                price = 73_500,
                warehouseStock = 45,
                storeStock = 12,
                minWarehouse = 25,
                minStore = 10,
            ),
            Product(
                id = "PRD-002",
                sku = "SMB-MNY-002",
                barcode = "8992775201027",
                name = "Minyak Goreng Bimoli Klasik Pouch 2L",
                category = "Sembako",
                units =
                    listOf(
                        unit("U-002", "Pouch", 1, 37_500, "8992775201027"),
                        unit("U-012", "Dus", 12, 450_000, "8992775201034"),
                    ),
                cost = 33_000,
                price = 37_500,
                warehouseStock = 60,
                storeStock = 6,
                minWarehouse = 30,
                minStore = 12,
            ),
            Product(
                id = "PRD-003",
                sku = "MIE-IND-003",
                barcode = "089686010947",
                name = "Indomie Mi Instan Goreng Spesial 85g",
                category = "Makanan Instan",
                units =
                    listOf(
                        unit("U-003", "Bungkus", 1, 3_200, "089686010947"),
                        unit("U-013", "Dus", 40, 128_000, "089686010954"),
                    ),
                cost = 2_720,
                price = 3_200,
                warehouseStock = 320,
                storeStock = 85,
                minWarehouse = 120,
                minStore = 40,
            ),
            Product(
                id = "PRD-004",
                sku = "SMB-GLA-004",
                barcode = "8995177101018",
                name = "Gulaku Gula Pasir Tebu Premium 1kg",
                category = "Sembako",
                units =
                    listOf(
                        unit("U-004", "Bungkus", 1, 18_000, "8995177101018"),
                        unit("U-014", "Dus", 20, 360_000, "8995177101025"),
                    ),
                cost = 15_750,
                price = 18_000,
                warehouseStock = 14,
                storeStock = 4,
                minWarehouse = 30,
                minStore = 10,
            ),
            Product(
                id = "PRD-005",
                sku = "MNM-KPI-005",
                barcode = "8991002101234",
                name = "Kopi Kapal Api Special Mix Renceng",
                category = "Minuman",
                units =
                    listOf(
                        unit("U-005", "Renceng", 1, 15_500, "8991002101234"),
                        unit("U-015", "Dus", 10, 155_000, "8991002101241"),
                    ),
                cost = 13_100,
                price = 15_500,
                warehouseStock = 50,
                storeStock = 18,
                minWarehouse = 25,
                minStore = 10,
            ),
            Product(
                id = "PRD-006",
                sku = "SUS-FFG-006",
                barcode = "8992753102211",
                name = "SKM Frisian Flag Putih Pouch 545g",
                category = "Susu",
                units =
                    listOf(
                        unit("U-006", "Pouch", 1, 17_500, "8992753102211"),
                        unit("U-016", "Dus", 24, 420_000, "8992753102228"),
                    ),
                cost = 14_850,
                price = 17_500,
                warehouseStock = 38,
                storeStock = 15,
                minWarehouse = 20,
                minStore = 8,
            ),
            Product(
                id = "PRD-007",
                sku = "BMB-KCP-007",
                barcode = "8999999001124",
                name = "Kecap Manis Bango Refill 520ml",
                category = "Bumbu Dapur",
                units =
                    listOf(
                        unit("U-007", "Pouch", 1, 25_000, "8999999001124"),
                        unit("U-017", "Dus", 12, 300_000, "8999999001131"),
                    ),
                cost = 21_400,
                price = 25_000,
                warehouseStock = 8,
                storeStock = 3,
                minWarehouse = 20,
                minStore = 8,
            ),
            Product(
                id = "PRD-008",
                sku = "RTG-SLG-008",
                barcode = "8998866200349",
                name = "Sunlight Jeruk Nipis 650ml",
                category = "Rumah Tangga",
                units =
                    listOf(
                        unit("U-008", "Pouch", 1, 15_000, "8998866200349"),
                        unit("U-018", "Dus", 12, 180_000, "8998866200356"),
                    ),
                cost = 12_300,
                price = 15_000,
                warehouseStock = 0,
                storeStock = 0,
                minWarehouse = 24,
                minStore = 8,
            ),
            Product(
                id = "PRD-009",
                sku = "MNM-AQU-009",
                barcode = "8886008101053",
                name = "Aqua Botol 600ml",
                category = "Minuman",
                units =
                    listOf(
                        unit("U-009", "Botol", 1, 4_000, "8886008101053"),
                        unit("U-019", "Dus", 24, 96_000, "8886008101060"),
                    ),
                cost = 1_825,
                price = 4_000,
                warehouseStock = 768,
                storeStock = 240,
                minWarehouse = 360,
                minStore = 120,
            ),
            Product(
                id = "PRD-010",
                sku = "SMB-TLR-010",
                barcode = "2001000000105",
                name = "Telur Ayam Negeri (Tray 30 butir)",
                category = "Sembako",
                units = listOf(unit("U-010", "Tray", 1, 55_000, "2001000000105")),
                cost = 48_800,
                price = 55_000,
                warehouseStock = 15,
                storeStock = 9,
                minWarehouse = 12,
                minStore = 6,
            ),
            Product(
                id = "PRD-011",
                sku = "MNM-TEH-011",
                barcode = "8991002502016",
                name = "Teh Celup Sariwangi isi 100",
                category = "Minuman",
                units =
                    listOf(
                        unit("U-011", "Kotak", 1, 9_800, "8991002502016"),
                        unit("U-020", "Dus", 24, 235_200, "8991002502023"),
                    ),
                cost = 8_200,
                price = 9_800,
                warehouseStock = 26,
                storeStock = 11,
                minWarehouse = 15,
                minStore = 6,
            ),
            Product(
                id = "PRD-012",
                sku = "RTG-LIF-012",
                barcode = "8999999056230",
                name = "Sabun Mandi Lifebuoy Total 10",
                category = "Rumah Tangga",
                units =
                    listOf(
                        unit("U-021", "Pcs", 1, 5_200, "8999999056230"),
                        unit("U-022", "Dus", 48, 249_600, "8999999056247"),
                    ),
                cost = 4_100,
                price = 5_200,
                warehouseStock = 40,
                storeStock = 14,
                minWarehouse = 20,
                minStore = 8,
            ),
        )

    val movements: Map<String, List<StockMovement>> =
        products.associate { product ->
            product.id to
                listOf(
                    StockMovement(
                        time = "24 Nov 2026, 11:04 WIB",
                        type = "Penerimaan",
                        location = Location.WAREHOUSE,
                        quantity = 10,
                        reference = "PB/2026/11/018",
                    ),
                    StockMovement(
                        time = "23 Nov 2026, 15:22 WIB",
                        type = "Mutasi keluar",
                        location = Location.WAREHOUSE,
                        quantity = -4,
                        reference = "MUT/2026/11/012",
                    ),
                    StockMovement(
                        time = "22 Nov 2026, 09:10 WIB",
                        type = "Penjualan",
                        location = Location.STORE,
                        quantity = -2,
                        reference = "POS/2026/11/2210",
                    ),
                )
        }

    val receipts =
        listOf(
            Receipt(
                id = "RCV-018",
                number = "PB/2026/11/018",
                supplierName = "CV Sumber Rejeki",
                time = "24 Nov 2026, 11:04 WIB",
                total = 1_250_000,
                status = "Tersinkron",
            ),
            Receipt(
                id = "RCV-017",
                number = "PB/2026/11/017",
                supplierName = "UD Makmur Abadi",
                time = "23 Nov 2026, 15:22 WIB",
                total = 840_000,
                status = "Tersinkron",
            ),
        )

    val adjustments =
        listOf(
            Adjustment(
                id = "ADJ-001",
                productId = "PRD-003",
                productName = "Indomie Mi Instan Goreng Spesial 85g",
                location = Location.STORE,
                systemQty = 85,
                physicalQty = 83,
                reason = "2 bungkus kemasan sobek",
                time = "24 Nov 2026, 10:22 WIB",
            ),
            Adjustment(
                id = "ADJ-002",
                productId = "PRD-004",
                productName = "Gulaku Gula Pasir Tebu Premium 1kg",
                location = Location.STORE,
                systemQty = 4,
                physicalQty = 4,
                reason = "Hitung ulang rak depan",
                time = "23 Nov 2026, 16:40 WIB",
            ),
        )

    val transfers =
        listOf(
            Transfer(
                id = "TRF-001",
                number = "MUT/2026/11/013",
                from = Location.WAREHOUSE,
                to = Location.STORE,
                status = "PENDING",
                createdBy = "Hendra Saputra",
                time = "24 Nov 2026, 09:10 WIB",
                lines = listOf(TransferLine("PRD-001", "U-001", 10), TransferLine("PRD-003", "U-003", 80)),
            ),
            Transfer(
                id = "TRF-002",
                number = "MUT/2026/11/012",
                from = Location.WAREHOUSE,
                to = Location.STORE,
                status = "COMPLETED",
                createdBy = "Hendra Saputra",
                time = "23 Nov 2026, 15:22 WIB",
                lines = listOf(TransferLine("PRD-002", "U-002", 12)),
            ),
        )

    val opnames =
        listOf(
            Opname(
                id = "OPN-001",
                number = "OPN/2026/11/001",
                location = Location.STORE,
                status = "PENDING_REVIEW",
                createdBy = "Hendra Saputra",
                time = "24 Nov 2026, 07:30 WIB",
                items = listOf(OpnameItem("PRD-003", systemQty = 85, physicalQty = 83)),
            ),
        )
}
