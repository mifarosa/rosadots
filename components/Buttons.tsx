import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLook } from '../look';
import { textOn } from '../theme';

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useLook();
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: colors[0] },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.primaryText, { color: textOn(colors[0]) }]}>{label}</Text>
    </Pressable>
  );
}

// Small outlined button for secondary actions.
export function QuietButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useLook();
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.quiet,
        { borderColor: theme.border },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.quietText, { color: theme.muted }]}>{label}</Text>
    </Pressable>
  );
}

// Big rounded "draw" button painted in a player's color.
export function ConfirmButton({
  color,
  onPress,
  disabled,
}: {
  color: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.confirm,
        { backgroundColor: color },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.confirmText, { color: textOn(color) }]}>✓ Çiz</Text>
    </Pressable>
  );
}

// Pick one of a few options, shown side by side.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const { theme, colors, tints } = useLook();
  return (
    <View style={styles.segRow}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[
              styles.seg,
              { borderColor: on ? colors[0] : theme.border },
              on && { backgroundColor: tints[0] },
            ]}
          >
            <Text style={[styles.segText, { color: theme.ink }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  primary: { width: 220, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  primaryText: { fontSize: 20, fontWeight: '700' },
  confirm: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: 28 },
  confirmText: { fontSize: 20, fontWeight: '800' },
  quiet: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  quietText: { fontWeight: '600', fontSize: 13 },
  segRow: { flexDirection: 'row', gap: 10 },
  seg: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 14, borderWidth: 2 },
  segText: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
});
