/**
 * Écran d'accueil provisoire de l'app mobile.
 *
 * Rôle : prouver que le squelette Expo démarre et se construit dans le
 * monorepo pnpm. Le vrai contenu arrive à l'étape 10.
 */
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** @returns L'écran d'accueil provisoire. */
export default function HomeScreen(): ReactNode {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Lueur
      </Text>
      <Text>En construction.</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '600' },
});
