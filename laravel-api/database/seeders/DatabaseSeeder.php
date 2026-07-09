<?php

namespace Database\Seeders;

use App\Models\EntiteOrganisationnelle;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Crée les entités organisationnelles, puis les utilisateurs de démo + 500 utilisateurs.
 * Les utilisateurs sont répartis dans les directions, services, divisions et bureaux (direction, service, entite_id).
 * Mot de passe commun : "password".
 */
class DatabaseSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'password';

    /** Rôles pour les utilisateurs de démo (un seul DG et un seul Super Admin). */
    private const ROLES = [
        'SUPER_ADMIN',
        'DIRECTEUR_GENERAL',
        'SECRETAIRE',
        'DIRECTEUR',
        'CHEF_SERVICE',
        'AGENT',
    ];

    /** Rôles utilisés pour la création en masse (500 users) : un seul DG en base, donc on n'en crée plus. */
    private const ROLES_BULK = [
        'SECRETAIRE',
        'DIRECTEUR',
        'CHEF_SERVICE',
        'AGENT',
    ];

    public function run(): void
    {
        // Rôles et permissions (persistés en base pour la gestion des accès)
        $this->call(RolesSeeder::class);
        // Types d'entités et entités organisationnelles (ARMP) en premier pour répartir les users
        $this->call(EntiteTypeDefinitionSeeder::class);
        $this->call(EntitesOrganisationnellesSeeder::class);

        $directions = EntiteOrganisationnelle::where('type', 'direction')->where('actif', true)->orderBy('ordre')->get();
        $divisions = EntiteOrganisationnelle::where('type', 'division')->where('actif', true)->orderBy('ordre')->get();
        $services = EntiteOrganisationnelle::where('type', 'service')->where('actif', true)->orderBy('ordre')->get();
        $sousServices = EntiteOrganisationnelle::where('type', 'sous-service')->where('actif', true)->orderBy('ordre')->get();
        $bureaux = EntiteOrganisationnelle::where('type', 'bureau')->where('actif', true)->orderBy('ordre')->get();

        $directionNames = $directions->pluck('nom')->toArray();
        $serviceNames = $services->pluck('nom')->toArray();
        $entitesPourRepartition = $divisions->merge($sousServices)->merge($bureaux)->values(); // divisions, sous-services, bureaux pour entite_id

        if ($directionNames === [] || $serviceNames === []) {
            $this->command->warn('Aucune direction ou service en base. Utilisation de valeurs de repli.');
            $directionNames = ['Direction Administrative et Financière'];
            $serviceNames = ['Service Logistique et Moyens généraux'];
        }

        $demoUsers = [
            ['name' => 'Super Admin', 'email' => 'admin@example.com', 'role' => 'SUPER_ADMIN', 'direction' => null, 'service' => null, 'entite_id' => null],
            ['name' => 'Marie Dupont', 'email' => 'secretaire@example.com', 'role' => 'SECRETAIRE', 'direction' => null, 'service' => null, 'entite_id' => null],
            ['name' => 'Jean Martin', 'email' => 'dg@example.com', 'role' => 'DIRECTEUR_GENERAL', 'direction' => null, 'service' => null, 'entite_id' => null],
            ['name' => 'Sophie Bernard', 'email' => 'directeur.admin@example.com', 'role' => 'DIRECTEUR', 'direction' => $directionNames[0] ?? 'Direction Administrative et Financière', 'service' => null, 'entite_id' => null],
            ['name' => 'Pierre Durand', 'email' => 'chef.rh@example.com', 'role' => 'CHEF_SERVICE', 'direction' => $directionNames[0] ?? 'Direction Administrative et Financière', 'service' => $serviceNames[0] ?? 'Service Recrutement et Carrières', 'entite_id' => null],
            ['name' => 'Lucie Moreau', 'email' => 'agent.rh@example.com', 'role' => 'AGENT', 'direction' => $directionNames[0] ?? 'Direction Administrative et Financière', 'service' => $serviceNames[0] ?? 'Service Recrutement et Carrières', 'entite_id' => $entitesPourRepartition->isNotEmpty() ? $entitesPourRepartition->random()->id : null],
        ];

        foreach ($demoUsers as $data) {
            $payload = [
                'name' => $data['name'],
                'password' => Hash::make(self::DEMO_PASSWORD),
                'role' => $data['role'],
                'direction' => $data['direction'],
                'service' => $data['service'],
                'entite_id' => $data['entite_id'],
                'actif' => true,
            ];
            User::updateOrCreate(
                ['email' => $data['email']],
                $payload
            );
        }

        $faker = \Faker\Factory::create('fr_FR');
        $existingCount = User::count();
        $toCreate = 500 - $existingCount;

        if ($toCreate <= 0) {
            $this->command->info("Déjà 500 utilisateurs ou plus. Total actuel : {$existingCount}.");
            $this->call(PlacerAgentsBureauxSeeder::class);
            $this->call(PlacerChefsDivisionSeeder::class);
            $this->call(CourrierSeeder::class);
            return;
        }

        $this->command->info("Création de {$toCreate} utilisateurs répartis dans les entités...");
        $hashedPassword = Hash::make(self::DEMO_PASSWORD);
        $chunkSize = 50;
        $chunk = [];
        $now = now();

        for ($i = 0; $i < $toCreate; $i++) {
            $role = $faker->randomElement(self::ROLES_BULK);
            $direction = null;
            $service = null;
            $entiteId = null;

            if (in_array($role, ['DIRECTEUR', 'CHEF_SERVICE', 'AGENT'], true)) {
                $dir = $directions->random();
                $direction = $dir->nom;
                if (in_array($role, ['CHEF_SERVICE', 'AGENT'], true)) {
                    $divisionIds = $divisions->where('parent_id', $dir->id)->pluck('id');
                    $servs = $services->whereIn('parent_id', $divisionIds);
                    if ($servs->isNotEmpty()) {
                        $serv = $servs->random();
                        $service = $serv->nom;
                    }
                }
                // Répartition : une partie des AGENT (et éventuellement CHEF_SERVICE) ont en plus un entite_id (division, bureau, sous-service)
                if ($entitesPourRepartition->isNotEmpty() && in_array($role, ['AGENT', 'CHEF_SERVICE'], true) && $faker->boolean(40)) {
                    $entiteId = $entitesPourRepartition->random()->id;
                }
            }

            $chunk[] = [
                'id' => (string) Str::uuid(),
                'name' => $faker->name(),
                'email' => $faker->unique()->safeEmail(),
                'password' => $hashedPassword,
                'role' => $role,
                'direction' => $direction,
                'service' => $service,
                'entite_id' => $entiteId,
                'actif' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (count($chunk) >= $chunkSize) {
                User::insert($chunk);
                $this->command->info('  ' . min($i + 1, $toCreate) . " / {$toCreate} créés.");
                $chunk = [];
            }
        }

        if (count($chunk) > 0) {
            User::insert($chunk);
        }

        $this->command->info('Total utilisateurs : ' . User::count());

        // Un seul Directeur Général autorisé (éliminer les doublons)
        $this->call(UnSeulDirecteurGeneralSeeder::class);

        // Affecter les agents sans entite_id à un bureau (répartition équilibrée)
        $this->call(PlacerAgentsBureauxSeeder::class);
        // Choisir un chef de division parmi les agents/bureaux de chaque division
        $this->call(PlacerChefsDivisionSeeder::class);

        $this->call(CourrierSeeder::class);
    }
}
