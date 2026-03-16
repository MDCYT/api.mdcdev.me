// Nueva ruta para recibir todos los POST del webhook de Trucky
const express = require("express");
const router = express.Router();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Esta ruta recibirá todos los POST enviados al webhook de Trucky
router.post("/", async (req, res) => {
  try {
    // Check if content-type is application/json
    if (req.headers["content-type"] !== "application/json") {
        console.error("Invalid content-type:", req.headers["content-type"]);
      return res
        .status(400)
        .json({ error: "Content-Type must be application/json" });
    }

    // Check if x-client and user-agent is Trucky
    if (
      req.headers["x-client"] !== "Trucky" ||
      !req.headers["user-agent"]?.includes("Trucky")
    ) {
        console.error("Invalid client or user-agent:", req.headers["x-client"], req.headers["user-agent"]);
      return res.status(400).json({ error: "Invalid client" });
    }

    // Check if x-trucky-company-id is present
    if (!req.headers["x-trucky-company-id"]) {
        console.error("Missing x-trucky-company-id header");
      return res.status(400).json({ error: "Missing ID" });
    }

    /*
      {
    "event": "job_created",
    "data": {
      "id": 23919628,
      "deleted_at": null,
      "created_at": "2026-03-16T15:05:39.000000Z",
      "updated_at": "2026-03-16T15:05:39.000000Z",
      "user_id": 255559,
      "game_id": 1,
      "company_id": 41407,
      "market": "cargo_market",
      "game_mode": "sp",
      "game_mode_end": null,
      "server": "",
      "status": "in_progress",
      "vehicle_id": null,
      "owned_trailer_id": null,
      "in_game_profile_id": "5045525520534552564552",
      "in_game_profile_name": "PERU SERVER",
      "vehicle_in_game_brand_id": "scania",
      "vehicle_in_game_id": "vehicle.scania.r_2016",
      "vehicle_brand_name": "Scania",
      "vehicle_model_name": "R",
      "trailer_in_game_id": "vehicle.swp_none.invisible_t",
      "trailer_name": "Invisible Trailer",
      "trailer_body_type": "dryvan",
      "trailer_chain_type": "single",
      "trailers_number": 1,
      "vehicle_odometer_start": 526,
      "vehicle_odometer_end": 0,
      "vehicle_odometer_difference_km": null,
      "vehicle_odometer_end_km": null,
      "vehicle_odometer_start_km": 526.33,
      "source_city_id": "junin",
      "source_city_name": "Junin Psv",
      "destination_city_id": "junin",
      "destination_city_name": "Junin Psv",
      "source_company_id": "marvisur",
      "source_company_name": "Agencia Marvisur",
      "destination_company_id": "shalom_cg",
      "destination_company_name": "Shalom Cargo",
      "cargo_id": "contrabando",
      "cargo_definition_id": null,
      "cargo_name": "Mercancias de Contrabando",
      "planned_distance": 1,
      "planned_distance_km": 1,
      "driven_distance": 0,
      "cargo_mass": 12,
      "cargo_mass_t": 12,
      "cargo_unit_count": 13,
      "cargo_unit_mass": 930,
      "income": 656,
      "income_details": null,
      "game_income": 656,
      "revenue": 0,
      "taxes": 0,
      "vehicle_damage": 0,
      "trailers_damage": 0,
      "cargo_damage": 0,
      "fuel_used": 0,
      "fuel_used_l": null,
      "fuel_cost": 0,
      "special_job": false,
      "auto_load": false,
      "auto_park": false,
      "other_costs_total": 0,
      "fines_details": null,
      "transports_details": null,
      "tollgates_details": null,
      "late_delivery": false,
      "started_at": "2026-03-16T15:05:39.000000Z",
      "completed_at": null,
      "canceled_at": null,
      "in_game_delivery_time": 775907,
      "in_game_time_start": 25902,
      "in_game_time_end": null,
      "max_map_scale": null,
      "real_driving_time_seconds": null,
      "currency": "T¢",
      "weight_unit": "t",
      "distance_unit": "km",
      "volume_unit": "l",
      "fuel_unit_price": 0,
      "stats_type": "none",
      "max_speed": null,
      "max_speed_kmh": null,
      "average_speed_kmh": null,
      "damage_cost": 0,
      "damage_cost_details": null,
      "timezone": "America/Lima",
      "rent_cost_per_km": 0,
      "rent_cost_total": 0,
      "driven_distance_km": null,
      "real_driven_distance_km": null,
      "deleted_by_user_id": null,
      "achievements": null,
      "points": 0,
      "warp": null,
      "realistic_settings": {
        "police": false,
        "detours": true,
        "fatigue": false,
        "detected": true,
        "road_events": true,
        "fuel_similation": false,
        "hud_speed_limit": true,
        "traffic_enabled": true,
        "bad_weather_factor": false,
        "parking_difficulty": false,
        "hardcore_simulation": false,
        "simple_parking_doubles": true,
        "trailer_advanced_coupling": false
      },
      "realistic_leaderboard": null,
      "realistic_reject_reasons": null,
      "realistic_ldb_points": null,
      "truck_wheels_consumption": null,
      "trailers_wheels_consumption": null,
      "speeding": null,
      "next_rest_stop_expired": null,
      "total_speeding_time": null,
      "delivery_rating": null,
      "truck_teleported_no_transports": null,
      "trailer_teleported_no_transports": null,
      "distance_driven_no_trailer": null,
      "duration": null,
      "total_damage": 0,
      "fuel_economy_l100km": null,
      "fuel_economy_kml": null,
      "fuel_economy_mpg": null,
      "realistic_points_calculation": null,
      "public_url": "https://hub.truckyapp.com/job/23919628",
      "delivery_rating_details": null,
      "company": {
        "id": 41407,
        "created_at": "2026-01-16T20:32:32.000000Z",
        "updated_at": "2026-03-16T15:02:26.000000Z",
        "deleted_at": null,
        "name": "Transportes Movil Bus [PSV]",
        "company_type": "miles",
        "owner_id": 251550,
        "external_id": null,
        "external_system": null,
        "slogan": "Viaja seguro, viaja en bus con Movil Bus",
        "about": null,
        "tag": "[MVB]",
        "avatar": "public/companies/41407/oXoKOG56ykHKcVJmqX8h.jpg",
        "cover": null,
        "headquarter_city_id": null,
        "discord": null,
        "twitter": null,
        "twitch": null,
        "youtube": null,
        "website": null,
        "facebook": null,
        "contact_email": null,
        "forum": null,
        "recruitment": "open",
        "language": "Spanish",
        "requirements": null,
        "currency": "T¢",
        "preferred_weight_unit": "t",
        "preferred_distance_unit": "km",
        "preferred_volume_unit": "l",
        "country_code": "PE",
        "ets2_discord_application_id": null,
        "ats_discord_application_id": null,
        "rules": null,
        "slug": "transportes-movil-bus-psv",
        "base_member_salary": 0,
        "application_requirements": null,
        "deleted_by_user_id": null,
        "discord_server_id": null,
        "auth_token": null,
        "salary_type": "fixed",
        "enable_ai_mechanics": false,
        "inactive_member_treshold": 30,
        "webhook_mode": "detailed",
        "current_insurance_prize": null,
        "job_cancelation_penalty": null,
        "rpc_app_id_ets2": null,
        "rpc_app_id_ats": null,
        "disable_cooldown": null,
        "admin_internal_comment": null,
        "banned_from_hardcore_ldb": null,
        "banned_from_distance_ldb": null,
        "webhook_ets2_distance_unit": "km",
        "webhook_ets2_weight_unit": "t",
        "webhook_ets2_volume_unit": "l",
        "webhook_ats_distance_unit": "mi",
        "webhook_ats_weight_unit": "lb",
        "webhook_ats_volume_unit": "gal",
        "event_notify_discord_roles": null,
        "avatar_url": "https://cdn.truckyapp.com/public/companies/41407/oXoKOG56ykHKcVJmqX8h.jpg",
        "cover_url": "https://e.truckyapp.com/assets/company-cover.png",
        "flag_url": "https://flagcdn.com/h20/pe.png",
        "public_url": "https://hub.truckyapp.com/vtc/transportes-movil-bus-psv",
        "integrations": {
          "discord_webhook_url": false,
          "discord_webhook_url_application_accepted": false,
          "discord_webhook_url_application_rejected": false,
          "notification_webhook_url": false
        },
        "owner": {
          "id": 251550,
          "name": "admin [psv]",
          "created_at": "2026-01-14T21:44:37.000000Z",
          "updated_at": "2026-02-01T16:38:13.000000Z",
          "company_id": 41407,
          "role_id": 118361,
          "company_rank_id": null,
          "type": null,
          "avatar_type": "remote",
          "language": null,
          "country": null,
          "website": null,
          "twitch": null,
          "twitter": null,
          "facebook": null,
          "wotr": null,
          "youtube": null,
          "discord_server": null,
          "level": 0,
          "points": 1,
          "hide_tags": null,
          "aggregated_distance_unit": "km",
          "aggregated_weight_unit": "t",
          "aggregated_volume_unit": "l",
          "ets2_distance_unit": "km",
          "ets2_weight_unit": "t",
          "ets2_volume_unit": "l",
          "ats_distance_unit": "mi",
          "ats_weight_unit": "lb",
          "ats_volume_unit": "gal",
          "ets2_fuel_economy_unit": "l100km",
          "ats_fuel_economy_unit": "mpg",
          "additional_roles": null,
          "banned_from_hardcore_ldb": null,
          "banned_from_distance_ldb": null,
          "avatar_url": "https://cdn.truckyapp.com/public/users/251550/gbXMFGxRasVelNixifmS.png",
          "flag_url": null,
          "has_discord_webhook_url": false,
          "public_url": "https://hub.truckyapp.com/user/251550",
          "steam_profile": {
            "steam_id": "76561198751080798",
            "steam_username": "admmovilbus"
          }
        }
      },
      "driver": {
        "id": 255559,
        "name": "[MVB] MDC",
        "created_at": "2026-02-06T04:42:52.000000Z",
        "updated_at": "2026-03-13T00:34:53.000000Z",
        "company_id": 41407,
        "role_id": 118362,
        "company_rank_id": null,
        "type": null,
        "avatar_type": "remote",
        "language": null,
        "country": null,
        "website": null,
        "twitch": null,
        "twitter": null,
        "facebook": null,
        "wotr": null,
        "youtube": null,
        "discord_server": null,
        "level": 4,
        "points": 17098,
        "hide_tags": null,
        "aggregated_distance_unit": "km",
        "aggregated_weight_unit": "t",
        "aggregated_volume_unit": "l",
        "ets2_distance_unit": "km",
        "ets2_weight_unit": "t",
        "ets2_volume_unit": "l",
        "ats_distance_unit": "mi",
        "ats_weight_unit": "lb",
        "ats_volume_unit": "gal",
        "ets2_fuel_economy_unit": "l100km",
        "ats_fuel_economy_unit": "mpg",
        "additional_roles": null,
        "banned_from_hardcore_ldb": null,
        "banned_from_distance_ldb": null,
        "avatar_url": "https://avatars.steamstatic.com/35aba5ec040ce38dd92f0cfa75e219f4922b9ca6_full.jpg",
        "flag_url": null,
        "has_discord_webhook_url": false,
        "public_url": "https://hub.truckyapp.com/user/255559",
        "steam_profile": {
          "steam_id": "76561198252380324",
          "steam_username": "MDC"
        }
      },
      "cargo_definition": null
    }
    */

    const companyId = req.headers["x-trucky-company-id"];
    const companyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/trucky_companies?company_id=eq.${companyId}`,
      {
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const companyData = await companyRes.json();
    if (!companyData.length) {
        console.error("Company not found for ID:", companyId);
      return res.status(400).json({ error: "Company not found" });
    }

    // Validar que req.body.data existe
    if (!req.body?.data) {
        console.error("Missing data in request body:", req.body);
      return res.status(400).json({ error: "Missing data" });
    }

    // Preparar los datos del trabajo
    const jobId = req.body.data.id;
    const jobData = {
      job_id: jobId,
      company_id: req.headers["x-trucky-company-id"],
      driver_id: req.body.data.driver.id,
      event_type: req.body.type,
      profile_id: req.body.data.in_game_profile_id,
      vehicle_id: req.body.data.vehicle_id,
      vehicle_brand_id: req.body.data.vehicle_in_game_brand_id,
      market: req.body.data.market,
      status: req.body.data.status,
      trailer_id: req.body.data.trailer_in_game_id,
      source_city_id: req.body.data.source_city_id,
      destination_city_id: req.body.data.destination_city_id,
      source_company_id: req.body.data.source_company_id,
      destination_company_id: req.body.data.destination_company_id,
      cargo_id: req.body.data.cargo_id,
      planned_distance_km: req.body.data.planned_distance_km,
      driven_distance_km: req.body.data.driven_distance_km,
      cargo_mass_t: req.body.data.cargo_mass_t,
      vehicle_damage: req.body.data.vehicle_damage,
      trailers_damage: req.body.data.trailers_damage,
      cargo_damage: req.body.data.cargo_damage,
      fuel_used_l: req.body.data.fuel_used_l,
      special_job: req.body.data.special_job,
      auto_load: req.body.data.auto_load,
      auto_park: req.body.data.auto_park,
      fines_details: req.body.data.fines_details,
      transports_details: req.body.data.transports_details,
      tollgates_details: req.body.data.tollgates_details,
      real_driving_time_seconds: req.body.data.real_driving_time_seconds,
      max_speed_kmh: req.body.data.max_speed_kmh,
      average_speed_kmh: req.body.data.average_speed_kmh,
      real_driven_distance_km: req.body.data.real_driven_distance_km,
      deleted_by_user_id: req.body.data.deleted_by_user_id,
      points: req.body.data.points,
      total_damage: req.body.data.total_damage,
      events: req.body.data.events,
      raw: JSON.stringify(req.body),
      updated_at: new Date(),
    };

    // Buscar si ya existe el job_id
    const jobRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs_webhooks?job_id=eq.${jobId}`, {
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    const jobExists = await jobRes.json();

    if (jobExists.length > 0) {
      // Si existe, actualizar (PATCH)
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs_webhooks?job_id=eq.${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify(jobData),
      });
      if (!patchRes.ok) {
        const error = await patchRes.text();
        return res.status(500).json({ error: "Failed to update", details: error });
      }
      return res.status(200).json({ ok: true, updated: true });
    } else {
      // Si no existe, insertar (POST)
      jobData.created_at = new Date();
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs_webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify(jobData),
      });
      if (!insertRes.ok) {
        const error = await insertRes.text();
        return res.status(500).json({ error: "Failed to insert", details: error });
      }
      return res.status(200).json({ ok: true, inserted: true });
    }
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
