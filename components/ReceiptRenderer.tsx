import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ReceiptData } from '../lib/scanTypes';

interface ReceiptRendererProps {
    receipt: ReceiptData;
    colors: any;
}

export const ReceiptRenderer: React.FC<ReceiptRendererProps> = ({ receipt, colors }) => {
    if (!receipt || !receipt.items) return null;

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

            {/* ─── ITEMS LIST ─── */}
            <View style={styles.itemsContainer}>
                {receipt.items.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                        <View style={styles.itemTextContainer}>
                            <Text style={[styles.translatedName, { color: colors.foreground }]}>
                                {item.translatedName}
                            </Text>
                            <Text style={[styles.originalName, { color: colors.mutedForeground }]}>
                                {item.originalName}
                            </Text>
                        </View>
                        <Text style={[styles.price, { color: colors.foreground }]}>
                            {item.price}
                        </Text>
                    </View>
                ))}
            </View>

            {/* ─── DASHED DIVIDER ─── */}
            <View style={styles.dividerContainer}>
                {/* We use a dashed border bottom to mimic a receipt tear line */}
                <View style={[styles.dashedLine, { borderColor: colors.border }]} />
            </View>

            {/* ─── TOTALS SECTION ─── */}
            <View style={styles.totalsContainer}>
                {/* Only render subtotal/fees if the AI successfully extracted them */}
                {receipt.subtotal && receipt.subtotal !== "0" && receipt.subtotal !== "N/A" && (
                    <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
                        <Text style={[styles.totalValue, { color: colors.foreground }]}>{receipt.subtotal}</Text>
                    </View>
                )}

                {receipt.tax && receipt.tax !== "0" && receipt.tax !== "N/A" && (
                    <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Tax</Text>
                        <Text style={[styles.totalValue, { color: colors.foreground }]}>{receipt.tax}</Text>
                    </View>
                )}

                {receipt.serviceCharge && receipt.serviceCharge !== "0" && receipt.serviceCharge !== "N/A" && (
                    <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Service Charge</Text>
                        <Text style={[styles.totalValue, { color: colors.foreground }]}>{receipt.serviceCharge}</Text>
                    </View>
                )}

                {/* Grand Total */}
                <View style={[styles.grandTotalRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>Total</Text>
                    <Text style={[styles.grandTotalValue, { color: colors.foreground }]}>
                        {receipt.currencySymbol} {receipt.total}
                    </Text>
                </View>
            </View>

        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 20,
        marginBottom: 0,
        marginTop: 12
    },
    itemsContainer: {
        gap: 16,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    itemTextContainer: {
        flex: 1,
        paddingRight: 16,
        gap: 2,
    },
    translatedName: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 15,
    },
    originalName: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
    },
    price: {
        fontFamily: 'Inter_500Medium',
        fontSize: 15,
    },
    dividerContainer: {
        marginVertical: 20,
        overflow: 'hidden',
    },
    dashedLine: {
        borderBottomWidth: 1,
        borderStyle: 'dashed',
        // Negative margin lets the dashed line bleed slightly closer to the card edges
        marginHorizontal: -4,
    },
    totalsContainer: {
        gap: 12,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
    },
    totalValue: {
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 16,
        borderTopWidth: 1,
    },
    grandTotalLabel: {
        fontFamily: 'Inter_700Bold',
        fontSize: 18,
    },
    grandTotalValue: {
        fontFamily: 'Inter_700Bold',
        fontSize: 18,
    },
});